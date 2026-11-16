"""Lay out the printed pieces on the printer's bed.

Each piece (print_group) keeps the print orientation set in model.py. The layout only turns a piece about Z,
which changes nothing about overhangs or bed contact, and moves it on the bed:

  1. each piece's real outline seen from above is taken (holes and notches included, not just its bounding box),
     grown by half of part_spacing_mm, and drawn on a grid of about 1 mm at every turn in 5° steps
  2. pieces are placed one by one, largest first, on the first plate where they fit: at every turn and every free
     spot, the one that keeps the plate's used area smallest wins, so L shapes nest into each other and small
     pieces fill gaps and through-holes; a few orders and scores are tried and the result with the fewest plates
     (then the tightest) is kept
  3. what does not fit on plate 1 goes onto plate 2 and so on, and each plate's layout is centered on the bed
  4. a piece that fits the bed at no angle, or is taller than the build height, gets a plate of its own and is
     reported as too_big; a piece that fits only diagonally is reported as diagonal

Coordinates of the result: in the print pose, with the center of plate 1's bed at (0, 0). Plate k (1-based)
is drawn at x = (k - 1) * plate_pitch_mm, so every plate can be shown side by side.
"""
from __future__ import annotations

import math

import numpy as np

EPS = 1e-6
ANGLE_STEP_DEG = 1      # search step for a piece that fits the bed only diagonally
PACK_STEP_DEG = 5       # turns tried when packing pieces together
GRID_CELLS = 300        # the packing grid has about this many cells across the bed (at least 1 mm each)
PLATE_GAP_MM = 40.0     # gap between plates when they are drawn side by side

FITS, DIAGONAL, TOO_BIG = "fits", "diagonal", "too_big"


def hull_xy(mesh) -> np.ndarray:
    """Corners of the convex hull of the mesh seen from above (XY)."""
    pts = np.asarray(mesh.vertices)[:, :2]
    try:
        from scipy.spatial import ConvexHull
        return pts[ConvexHull(pts).vertices]
    except Exception:   # flat or degenerate outline: all points still give the right extents
        return pts


def _rot2(angle_deg: float) -> np.ndarray:
    a = math.radians(angle_deg)
    return np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])


def footprint(pts: np.ndarray, angle_deg: float) -> tuple[float, float]:
    """Width (X) and depth (Y) of the outline turned by angle_deg about Z."""
    r = pts @ _rot2(angle_deg).T
    ext = r.max(0) - r.min(0)
    return float(ext[0]), float(ext[1])


def turn_options(pts: np.ndarray, height: float, bed) -> tuple[str, list[tuple[float, float, float]]]:
    """How a piece can sit on the bed: (status, [(turn_deg, width, depth), ...]), preferred option first."""
    X, Y, Z = (float(v) for v in bed)
    axis = [(a, *footprint(pts, a)) for a in (0, 90)]
    if height > Z + EPS:
        return TOO_BIG, [min(axis, key=lambda o: max(o[1] - X, o[2] - Y))]
    ok = [o for o in axis if o[1] <= X + EPS and o[2] <= Y + EPS]
    if ok:
        return FITS, ok
    best = None
    for a in range(0, 180, ANGLE_STEP_DEG):
        if a % 90 == 0:
            continue
        w, d = footprint(pts, a)
        margin = min(X - w, Y - d)
        if margin >= -EPS and (best is None or margin > best[0]):
            best = (margin, a, w, d)
    if best:
        return DIAGONAL, [best[1:]]
    return TOO_BIG, [min(axis, key=lambda o: max(o[1] - X, o[2] - Y))]


def fits_bed(mesh, bed) -> bool:
    """Whether a piece already in print pose fits the build volume at some turn about Z."""
    status, _ = turn_options(hull_xy(mesh), float(mesh.extents[2]), bed)
    return status != TOO_BIG


# --------------------------------------------------------------------- outline packing on a grid
MAX_OUTLINE_FACES = 300_000     # above this the convex hull stands in for the outline (keeps build() quick)


def outline_xy(mesh):
    """Outline of the mesh seen from above (shapely): the union of its upward-facing triangles, so notches and
    holes that go all the way through are kept. The convex hull stands in when that fails or the mesh is huge."""
    import shapely
    from shapely.geometry import MultiPoint
    hull = MultiPoint(hull_xy(mesh)).convex_hull
    try:
        faces = np.asarray(mesh.faces)
        if len(faces) > MAX_OUTLINE_FACES:
            return hull
        up = np.asarray(mesh.face_normals)[:, 2] > 1e-9   # a closed mesh's top faces cover its whole outline
        t = np.asarray(mesh.vertices)[faces[up]][:, :, :2]
        e1, e2 = t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]
        area = e1[:, 0] * e2[:, 1] - e2[:, 0] * e1[:, 1]
        t = t[np.abs(area) > 1e-9]
        if not len(t):
            return hull
        poly = shapely.union_all(shapely.polygons(np.concatenate([t, t[:, :1]], axis=1)), grid_size=0.01)
        poly = poly.buffer(0.01).buffer(-0.01)            # close hairline seams between triangles
        return poly if poly.area > 1e-6 else hull
    except Exception:
        return hull


class _Shape:
    """One piece at one turn: its grid mask and where its bounding box sits in the mask."""

    def __init__(self, poly, verts_xy: np.ndarray, angle: float, grow: float, res: float):
        from shapely import contains_xy
        from shapely.affinity import affine_transform
        c, s_ = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        r = verts_xy @ _rot2(angle).T
        self.angle = angle
        self.lo, self.hi = r.min(0), r.max(0)                      # bounding box of the real piece
        # grow by half the spacing plus half a cell diagonal, so any two masks that do not overlap keep the
        # full spacing between the real pieces
        g = affine_transform(poly, [c, -s_, s_, c, 0, 0]).buffer(grow + res * 0.71, quad_segs=4)
        x0, y0, x1, y1 = g.bounds
        self.origin = np.array([x0, y0])
        nx, ny = max(1, math.ceil((x1 - x0) / res)), max(1, math.ceil((y1 - y0) / res))
        xs = x0 + (np.arange(nx) + 0.5) * res
        ys = y0 + (np.arange(ny) + 0.5) * res
        X, Y = np.meshgrid(xs, ys, indexing="ij")
        self.mask = contains_xy(g, X, Y).astype(np.float32)
        self.cells = int(self.mask.sum())


class _Board:
    """Occupancy grid of one plate. Cell (i, j) covers x in [-s/2 + i*res, ...), y likewise, so a piece grown
    by s/2 may reach the bed edge."""

    def __init__(self, X: float, Y: float, s: float, res: float):
        self.res, self.edge = res, -s / 2
        self.occ = np.zeros((int((X + s) / res + EPS), int((Y + s) / res + EPS)), dtype=np.float32)
        self.box = None                                               # used cells (i0, j0, i1, j1)
        self.pieces: list[tuple[str, _Shape, int, int]] = []

    def spots(self, sh: _Shape):
        """Free positions (i, j) arrays of the mask's corner, or None."""
        from scipy.signal import fftconvolve
        W, H = self.occ.shape
        w, h = sh.mask.shape
        if w > W or h > H:
            return None
        if self.box is None:
            hit = np.zeros((W - w + 1, H - h + 1), dtype=bool)
        else:
            hit = fftconvolve(self.occ, sh.mask[::-1, ::-1], mode="valid") > 0.5
        ii, jj = np.nonzero(~hit)
        return (ii, jj) if len(ii) else None

    def score(self, sh: _Shape, ii, jj, mode: str):
        """Score of each position (lower is better): used area of the plate after placing, or its longer side."""
        w, h = sh.mask.shape
        W, H = self.occ.shape
        if self.box is None:
            i0, j0, i1, j1 = ii, jj, ii + w, jj + h
        else:
            b = self.box
            i0, j0 = np.minimum(b[0], ii), np.minimum(b[1], jj)
            i1, j1 = np.maximum(b[2], ii + w), np.maximum(b[3], jj + h)
        area = (i1 - i0) * (j1 - j0) / (W * H)
        side = np.maximum((i1 - i0) / W, (j1 - j0) / H)
        tie = (ii + jj) / (W + H) * 1e-3                             # toward the front-left corner
        return (side + area * 1e-2 if mode == "side" else area + side * 1e-2) + tie

    def put(self, name: str, sh: _Shape, i: int, j: int):
        w, h = sh.mask.shape
        self.occ[i:i + w, j:j + h] += sh.mask
        b = (i, j, i + w, j + h)
        self.box = b if self.box is None else (min(self.box[0], b[0]), min(self.box[1], b[1]),
                                               max(self.box[2], b[2]), max(self.box[3], b[3]))
        self.pieces.append((name, sh, i, j))

    def real_box(self, sh: _Shape, i: int, j: int):
        """Bounding box of the real piece on the bed (bed coordinates, front-left corner at 0, 0)."""
        corner = np.array([self.edge + i * self.res, self.edge + j * self.res])
        return corner + (sh.lo - sh.origin), corner + (sh.hi - sh.origin)


def _pack(order, shapes, X, Y, s, res, mode, own):
    """One greedy run. Returns (boards, alone) where alone are pieces put on plates of their own."""
    boards: list[_Board] = []
    alone = []
    for g in order:
        if g in own:
            alone.append(g)
            continue
        done = False
        for b in boards + [None]:
            if b is None:
                b = _Board(X, Y, s, res)
                fresh = True
            else:
                fresh = False
            best = None
            for sh in shapes[g]:
                sp = b.spots(sh)
                if sp is None:
                    continue
                sc = b.score(sh, *sp, mode)
                k = int(np.argmin(sc))
                if best is None or sc[k] < best[0] - 1e-9:
                    best = (sc[k], sh, int(sp[0][k]), int(sp[1][k]))
            if best:
                b.put(g, best[1], best[2], best[3])
                if fresh:
                    boards.append(b)
                done = True
                break
            if fresh:
                break
        if not done:          # fits the bed but not on the grid (a very tight fit): a plate of its own
            alone.append(g)
    return boards, alone


def arrange(pieces: dict, bed, spacing: float) -> dict:
    """Lay out pieces ({name: mesh already in print pose}) on plates of the given bed.

    Returns {"bed_mm", "spacing_mm", "plates", "plate_pitch_mm", "pieces": {name: {"plate", "turn_deg",
    "center_xy", "footprint_mm", "fit"}}}; center_xy is the center of the piece's bounding box (after the turn)
    relative to its plate's center.
    """
    X, Y = float(bed[0]), float(bed[1])
    s = float(spacing)
    res = max(1.0, max(X, Y) / GRID_CELLS)
    opts, shapes, own = {}, {}, set()
    for g, m in pieces.items():
        hull = hull_xy(m)
        opts[g] = turn_options(hull, float(m.extents[2]), bed)
        if opts[g][0] == TOO_BIG:
            own.add(g)
            continue
        poly, verts = outline_xy(m), np.asarray(m.vertices)[:, :2]
        seen, shapes[g] = set(), []
        for a in range(0, 360, PACK_STEP_DEG):
            sh = _Shape(poly, verts, float(a), s / 2, res)
            key = (sh.mask.shape, sh.mask.tobytes())
            if key not in seen:                     # symmetric pieces repeat the same mask
                seen.add(key)
                shapes[g].append(sh)
    area = {g: max(sh.cells for sh in shapes[g]) if g in shapes else 0 for g in pieces}
    size = {g: max(max(sh.mask.shape) for sh in shapes[g]) if g in shapes else 0 for g in pieces}
    orders = [sorted(pieces, key=lambda g: (-area[g], g)), sorted(pieces, key=lambda g: (-size[g], -area[g], g))]
    need = max(1, math.ceil(sum(min(sh.cells for sh in shapes[g]) for g in shapes) * res * res / ((X + s) * (Y + s))))
    best = None
    for order in orders:
        for mode in ("area", "side"):
            boards, alone = _pack(order, shapes, X, Y, s, res, mode, own)
            n = len(boards) + len(alone)
            used = sum((b.box[2] - b.box[0]) * (b.box[3] - b.box[1]) for b in boards)
            if best is None or (n, used) < best[0]:
                best = ((n, used), boards, alone)
        if best[0][0] <= need + len(own):
            break
    _, boards, alone = best

    out = {}
    for k, b in enumerate(boards):
        boxes = {g: b.real_box(sh, i, j) for g, sh, i, j in b.pieces}
        lo = np.min([v[0] for v in boxes.values()], axis=0)
        hi = np.max([v[1] for v in boxes.values()], axis=0)
        shift = -(lo + hi) / 2
        for g, sh, _, _ in b.pieces:
            blo, bhi = boxes[g]
            c = (blo + bhi) / 2 + shift
            out[g] = {"plate": k + 1, "turn_deg": float(sh.angle % 360),
                      "center_xy": [round(float(c[0]), 3), round(float(c[1]), 3)],
                      "footprint_mm": [round(float(v), 2) for v in (bhi - blo)], "fit": opts[g][0]}
    for k, g in enumerate(alone, start=len(boards)):
        a, w, d = opts[g][1][0]
        out[g] = {"plate": k + 1, "turn_deg": float(a), "center_xy": [0.0, 0.0],
                  "footprint_mm": [round(w, 2), round(d, 2)], "fit": opts[g][0]}
    return {"bed_mm": [float(v) for v in bed], "spacing_mm": s, "plates": len(boards) + len(alone),
            "plate_pitch_mm": X + PLATE_GAP_MM, "pieces": {g: out[g] for g in pieces}}


def is_current(layout: dict | None, printer: dict) -> bool:
    """Whether a print_layout from parts.json was made with the printer's current bed and part spacing."""
    return (bool(layout) and [float(v) for v in layout["bed_mm"]] == [float(v) for v in printer["build_volume_mm"]]
            and float(layout["spacing_mm"]) == float(printer["part_spacing_mm"]))


def placement_matrix(mesh, piece: dict, plate_pitch: float) -> np.ndarray:
    """4×4 matrix that turns a piece in print pose (bottom at Z=0) about Z and moves it to its spot on the plates."""
    R = np.eye(4)
    R[:2, :2] = _rot2(piece["turn_deg"])
    r = np.asarray(mesh.vertices)[:, :2] @ R[:2, :2].T
    center = (r.min(0) + r.max(0)) / 2
    T = np.eye(4)
    T[0, 3] = (piece["plate"] - 1) * plate_pitch + piece["center_xy"][0] - center[0]
    T[1, 3] = piece["center_xy"][1] - center[1]
    return T @ R
