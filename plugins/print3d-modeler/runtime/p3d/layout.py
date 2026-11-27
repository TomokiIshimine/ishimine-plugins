"""Lay out the printed pieces on the printer's bed.

Each piece (print_group) keeps the print orientation set in model.py. The layout only turns a piece about Z,
which changes nothing about overhangs or bed contact, and moves it on the bed:

  1. each piece's real outline seen from above is taken: the whole solid projected onto the bed, so parts that
     overhang beyond the bed contact face count too (holes and notches included, not just its bounding box),
     grown by half of part_spacing_mm, and drawn on a grid of about 1 mm at every turn in 5° steps
  2. pieces are placed one by one, largest first, on the first plate where they fit: at every turn and every free
     spot, the one that keeps the plate's used area smallest wins, so L shapes nest into each other and small
     pieces fill gaps and through-holes; a few orders, scores and starting points (the middle of the bed or its
     corner) are tried, and the result with the fewest plates, then the one with the big pieces nearest the middle
     of the bed, is kept
  3. what does not fit on plate 1 goes onto plate 2 and so on, and each plate's layout is centered on the bed
  4. pieces keep away from the bed's edges, where the bed runs cooler and a brim has no room: 15 mm if that needs
     no extra plate, else 10, 5 or 0 mm (the widest margin that keeps the fewest plates), and they never cover the
     areas the printer keeps free (bed_exclude_mm, such as the front-left corner of the Bambu Lab X1 and P1 series)
  5. a piece that fits the bed at no angle, or is taller than the build height, gets a plate of its own and is
     reported as too_big; a piece that fits only diagonally is reported as diagonal, and one that fits the bed
     only over an area the printer keeps free is reported as blocked

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
EDGE_MARGINS_MM = (15.0, 10.0, 5.0, 0.0)   # margins from the bed's edges, tried widest first

FITS, DIAGONAL, TOO_BIG, BLOCKED = "fits", "diagonal", "too_big", "blocked"


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
        self.ffts: dict = {}                                        # FFT of the flipped mask per FFT size


def _blocked(X: float, Y: float, s: float, res: float, margin: float, exclude) -> np.ndarray:
    """Cells of a plate's grid where no piece may go: a band of `margin` mm along the bed's edges and the printer's
    excluded areas (rectangles in bed coordinates, front-left corner at 0, 0)."""
    W, H = int((X + s) / res + EPS), int((Y + s) / res + EPS)
    b = np.zeros((W, H), dtype=np.float32)
    k = math.ceil(margin / res + 0.5) if margin > 0 else 0   # half a cell more, for the grid's rounding
    if k:
        b[:k, :] = b[-k:, :] = 1
        b[:, :k] = b[:, -k:] = 1
    for x0, y0, x1, y1 in exclude:
        i0, i1 = max(0, math.floor((x0 + s / 2) / res)), min(W, math.ceil((x1 + s / 2) / res))
        j0, j1 = max(0, math.floor((y0 + s / 2) / res)), min(H, math.ceil((y1 + s / 2) / res))
        b[i0:i1, j0:j1] = 1
    return b


class _Grid:
    """What every plate of one packing run shares: cell size, blocked cells and the FFTs used to find free spots.
    FFT sizes come in a few steps (masks rounded up to 32 cells), so a plate's occupancy is transformed once per
    step after each placement and each piece mask once per run; finding spots then costs one inverse FFT per turn."""

    STEP = 32

    def __init__(self, blocked: np.ndarray, s: float, res: float):
        self.res, self.edge, self.blocked = res, -s / 2, blocked
        self.has_blocked = bool(blocked.any())
        self._blocked_f: dict = {}

    def size(self, sh: _Shape) -> tuple[int, int]:
        from scipy.fft import next_fast_len
        W, H = self.blocked.shape
        w, h = (-(-n // self.STEP) * self.STEP for n in sh.mask.shape)
        return next_fast_len(W + w - 1, real=True), next_fast_len(H + h - 1, real=True)

    def fft(self, a: np.ndarray, size):
        from scipy.fft import rfft2
        return rfft2(a, s=size, workers=-1)

    def blocked_f(self, size):
        f = self._blocked_f.get(size)
        if f is None:
            f = self._blocked_f[size] = self.fft(self.blocked, size)
        return f

    def overlap(self, occ_f, sh: _Shape, size) -> np.ndarray:
        """Full correlation of the occupancy with the piece mask (overlap in cells for every offset)."""
        from scipy.fft import irfft2
        f = sh.ffts.get(size)
        if f is None:
            f = sh.ffts[size] = self.fft(sh.mask[::-1, ::-1], size)
        return irfft2(occ_f * f, s=size, workers=-1)


class _Board:
    """Occupancy grid of one plate. Cell (i, j) covers x in [-s/2 + i*res, ...), y likewise, so a piece grown
    by s/2 may reach the bed edge; `blocked` cells (edge margin, excluded areas) start occupied."""

    def __init__(self, grid: _Grid):
        self.grid = grid
        self.res, self.edge = grid.res, grid.edge
        self.blocked = grid.blocked
        self.occ = grid.blocked.copy()
        self.occ_f: dict = {}                                         # FFT of occ per FFT size, cleared on put
        self.box = None                                               # cells used by pieces (i0, j0, i1, j1)
        self.pieces: list[tuple[str, _Shape, int, int]] = []

    def spots(self, sh: _Shape):
        """Free positions (i, j) arrays of the mask's corner, or None."""
        W, H = self.occ.shape
        w, h = sh.mask.shape
        if w > W or h > H:
            return None
        if self.box is None and not self.grid.has_blocked:            # nothing on the plate yet
            hit = np.zeros((W - w + 1, H - h + 1), dtype=bool)
        else:
            size = self.grid.size(sh)
            f = self.occ_f.get(size)
            if f is None:
                f = self.occ_f[size] = (self.grid.blocked_f(size) if self.box is None
                                        else self.grid.fft(self.occ, size))
            hit = self.grid.overlap(f, sh, size)[w - 1:W, h - 1:H] > 0.5
        ii, jj = np.nonzero(~hit)
        return (ii, jj) if len(ii) else None

    def score(self, sh: _Shape, ii, jj, mode: str, tie: str):
        """Score of each position (lower is better): used area of the plate after placing, or its longer side.
        Ties go toward the middle of the bed (tie="center") or its front-left corner (tie="corner")."""
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
        if tie == "center":
            pos = np.abs(ii + (w - W) / 2) + np.abs(jj + (h - H) / 2)
        else:
            pos = ii + jj
        return (side + area * 1e-2 if mode == "side" else area + side * 1e-2) + pos / (W + H) * 1e-3

    def put(self, name: str, sh: _Shape, i: int, j: int):
        w, h = sh.mask.shape
        self.occ[i:i + w, j:j + h] += sh.mask
        self.occ_f = {}
        b = (i, j, i + w, j + h)
        self.box = b if self.box is None else (min(self.box[0], b[0]), min(self.box[1], b[1]),
                                               max(self.box[2], b[2]), max(self.box[3], b[3]))
        self.pieces.append((name, sh, i, j))

    def real_box(self, sh: _Shape, i: int, j: int):
        """Bounding box of the real piece on the bed (bed coordinates, front-left corner at 0, 0)."""
        corner = np.array([self.edge + i * self.res, self.edge + j * self.res])
        return corner + (sh.lo - sh.origin), corner + (sh.hi - sh.origin)

    def center_shift(self, X: float, Y: float) -> np.ndarray:
        """Shift (mm) that centers the pieces on the bed, shortened when the full shift would push a piece into a
        blocked cell (an excluded area)."""
        boxes = [self.real_box(sh, i, j) for _, sh, i, j in self.pieces]
        lo = np.min([b[0] for b in boxes], axis=0)
        hi = np.max([b[1] for b in boxes], axis=0)
        full = np.array([X / 2, Y / 2]) - (lo + hi) / 2
        W, H = self.blocked.shape
        for t in (1.0, 0.75, 0.5, 0.25):
            di, dj = (int(round(v)) for v in full * t / self.res)
            ok = True
            for _, sh, i, j in self.pieces:
                w, h = sh.mask.shape
                a, c = i + di, j + dj
                if a < 0 or c < 0 or a + w > W or c + h > H or (self.blocked[a:a + w, c:c + h] * sh.mask).sum() > 0.5:
                    ok = False
                    break
            if ok:
                return full * t
        return np.zeros(2)


def _pack(order, shapes, grid, mode, tie, own, limit=None):
    """One greedy run. Returns (boards, alone) where alone are pieces put on plates of their own, or None as soon as
    more than `limit` plates would be needed."""
    boards: list[_Board] = []
    alone = []
    for g in order:
        if limit is not None and len(boards) + len(alone) > limit:
            return None
        if g in own:
            alone.append(g)
            continue
        done = False
        for b in boards + [None]:
            if b is None:
                b = _Board(grid)
                fresh = True
            else:
                fresh = False
            best = None
            for sh in shapes[g]:
                sp = b.spots(sh)
                if sp is None:
                    continue
                sc = b.score(sh, *sp, mode, tie)
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
    if limit is not None and len(boards) + len(alone) > limit:
        return None
    return boards, alone


def _spread(boards, X: float, Y: float) -> float:
    """How far the pieces sit from the middle of the bed after centering, weighted by their size (lower is better):
    big pieces near the middle, small ones toward the edges."""
    total, weight = 0.0, 0.0
    for b in boards:
        shift = b.center_shift(X, Y)
        for _, sh, i, j in b.pieces:
            lo, hi = b.real_box(sh, i, j)
            c = (lo + hi) / 2 + shift
            total += sh.cells * float(np.hypot(c[0] - X / 2, c[1] - Y / 2))
            weight += sh.cells
    return total / max(weight, 1.0) / math.hypot(X, Y)


SPOT_STEPS = 24     # positions tried along each axis for a piece alone on its plate


def _free_spot(mesh, turn: float, X: float, Y: float, exclude):
    """Where a piece alone on its plate goes: the center of its bounding box relative to the bed's center, as near
    the middle as its real outline (turned by `turn`) clears every excluded area, or None when no spot does."""
    if not exclude:
        return 0.0, 0.0
    from shapely.affinity import rotate, translate
    from shapely.geometry import box
    o = rotate(outline_xy(mesh), turn, origin=(0, 0))
    x0, y0, x1, y1 = o.bounds
    o = translate(o, -(x0 + x1) / 2, -(y0 + y1) / 2)      # bounding box centered on (0, 0)
    rx, ry = max(0.0, (X - (x1 - x0)) / 2), max(0.0, (Y - (y1 - y0)) / 2)
    boxes = [box(*r) for r in exclude]
    spots = sorted(((cx, cy) for cx in np.linspace(-rx, rx, 2 * SPOT_STEPS + 1)
                    for cy in np.linspace(-ry, ry, 2 * SPOT_STEPS + 1)), key=lambda c: math.hypot(*c))
    for cx, cy in spots:
        p = translate(o, X / 2 + cx, Y / 2 + cy)
        if all(p.intersection(b).area < 1e-6 for b in boxes):
            return float(cx), float(cy)
    return None


def bed_exclude(printer: dict) -> list[list[float]]:
    """Areas of the bed the printer keeps free (printer.json bed_exclude_mm: [x0, y0, x1, y1] rectangles in mm,
    front-left corner of the build volume at 0, 0). The area both nozzles of a two-nozzle printer reach has none."""
    if printer.get("nozzle_mode") == "dual":
        return []
    return [[float(v) for v in r] for r in printer.get("bed_exclude_mm") or []]


def arrange(pieces: dict, bed, spacing: float, exclude=()) -> dict:
    """Lay out pieces ({name: mesh already in print pose}) on plates of the given bed.

    exclude: areas of the bed no piece may cover ([x0, y0, x1, y1] in mm, front-left corner at 0, 0; see bed_exclude).
    Pieces keep a margin from the bed's edges: the widest of EDGE_MARGINS_MM that needs no more plates than packing
    up to the edges does.

    Returns {"bed_mm", "spacing_mm", "edge_margin_mm", "exclude_mm", "plates", "plate_pitch_mm", "pieces": {name:
    {"plate", "turn_deg", "center_xy", "footprint_mm", "fit"}}}; center_xy is the center of the piece's bounding box
    (after the turn) relative to its plate's center.
    """
    X, Y = float(bed[0]), float(bed[1])
    s = float(spacing)
    exclude = [[float(v) for v in r] for r in exclude]
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
    floor = need + len(own)                         # no packing can use fewer plates

    def run(margin: float, limit=None):
        """Best layout with this edge margin: fewest plates, then big pieces nearest the middle. None when every try
        needs more than `limit` plates."""
        grid = _Grid(_blocked(X, Y, s, res, margin, exclude), s, res)
        best = None
        for order in orders:
            for mode in ("area", "side"):
                for tie in ("center", "corner"):
                    r = _pack(order, shapes, grid, mode, tie, own, limit)
                    if r is None or (margin > 0 and any(g not in own for g in r[1])):
                        continue        # a piece that misses the margin or an excluded area is not a fit here
                    key = (len(r[0]) + len(r[1]), _spread(r[0], X, Y))
                    if best is None or key < best[0]:
                        best = (key, *r)
            if best is not None and best[0][0] <= floor:
                break
        return None if best is None else (best[0][0], best[1], best[2])

    margin = EDGE_MARGINS_MM[0]
    chosen = run(margin)
    if chosen is None or chosen[0] > floor:         # maybe a narrower margin fits, or needs fewer plates
        fewest, margin = run(0.0), 0.0
        if chosen is not None and chosen[0] <= fewest[0]:
            margin, fewest = EDGE_MARGINS_MM[0], chosen
        else:
            for m in EDGE_MARGINS_MM[1:-1]:
                r = run(m, fewest[0])
                if r is not None:
                    margin, fewest = m, r
                    break
        chosen = fewest
    _, boards, alone = chosen

    out = {}
    for k, b in enumerate(boards):
        shift = b.center_shift(X, Y)
        for g, sh, i, j in b.pieces:
            blo, bhi = b.real_box(sh, i, j)
            c = (blo + bhi) / 2 + shift - np.array([X / 2, Y / 2])
            out[g] = {"plate": k + 1, "turn_deg": float(sh.angle % 360),
                      "center_xy": [round(float(c[0]), 3), round(float(c[1]), 3)],
                      "footprint_mm": [round(float(v), 2) for v in (bhi - blo)], "fit": opts[g][0]}
    for k, g in enumerate(alone, start=len(boards)):
        a, w, d = opts[g][1][0]
        fit, c = opts[g][0], (0.0, 0.0)
        if g not in own:        # did not fit the grid: look for a spot clear of the excluded areas on the real outline
            c = _free_spot(pieces[g], a, X, Y, exclude)
            if c is None:
                fit, c = BLOCKED, (0.0, 0.0)
        out[g] = {"plate": k + 1, "turn_deg": float(a), "center_xy": [round(c[0], 3), round(c[1], 3)],
                  "footprint_mm": [round(w, 2), round(d, 2)], "fit": fit}
    return {"bed_mm": [float(v) for v in bed], "spacing_mm": s, "edge_margin_mm": margin, "exclude_mm": exclude,
            "plates": len(boards) + len(alone), "plate_pitch_mm": X + PLATE_GAP_MM,
            "pieces": {g: out[g] for g in pieces}}


def is_current(layout: dict | None, printer: dict) -> bool:
    """Whether a print_layout from parts.json was made with the printer's current bed, part spacing and excluded
    areas (layouts from before excluded areas were known count as made without any)."""
    return (bool(layout) and [float(v) for v in layout["bed_mm"]] == [float(v) for v in printer["build_volume_mm"]]
            and float(layout["spacing_mm"]) == float(printer["part_spacing_mm"])
            and [[float(v) for v in r] for r in layout.get("exclude_mm") or []] == bed_exclude(printer))


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
