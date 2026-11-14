"""Lay out the printed pieces on the printer's bed.

Each piece (print_group) keeps the print orientation set in model.py. The layout only turns a piece about Z,
which changes nothing about overhangs or bed contact, and moves it on the bed:

  1. a piece that fits as is, or turned 90°, keeps that axis-aligned footprint
  2. a piece too long for the bed either way is tried at every angle (1° steps): a long part often fits diagonally
  3. pieces are packed onto as few plates as possible (rectangle packing with part_spacing_mm between pieces);
     what does not fit on plate 1 goes onto plate 2 and so on, and each plate's layout is centered on the bed
  4. a piece that fits the bed at no angle, or is taller than the build height, gets a plate of its own and is
     reported as too_big

Coordinates of the result: in the print pose, with the center of plate 1's bed at (0, 0). Plate k (1-based)
is drawn at x = (k - 1) * plate_pitch_mm, so every plate can be shown side by side.
"""
from __future__ import annotations

import math

import numpy as np

EPS = 1e-6
ANGLE_STEP_DEG = 1
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


# --------------------------------------------------------------------- rectangle packing (MaxRects)
class _Plate:
    def __init__(self, w: float, h: float):
        self.free = [(0.0, 0.0, w, h)]
        self.used: list[tuple[str, float, float, float, float]] = []   # (name, x, y, w, h) without spacing

    def find(self, w: float, h: float):
        """Best free spot for a w×h rectangle: (score, x, y) or None (best short side fit)."""
        best = None
        for fx, fy, fw, fh in self.free:
            if w <= fw + EPS and h <= fh + EPS:
                score = (min(fw - w, fh - h), max(fw - w, fh - h))
                if best is None or score < best[0]:
                    best = (score, fx, fy)
        return best

    def place(self, x: float, y: float, w: float, h: float):
        new = []
        for f in self.free:
            fx, fy, fw, fh = f
            if x >= fx + fw - EPS or x + w <= fx + EPS or y >= fy + fh - EPS or y + h <= fy + EPS:
                new.append(f)
                continue
            if x > fx + EPS:
                new.append((fx, fy, x - fx, fh))
            if x + w < fx + fw - EPS:
                new.append((x + w, fy, fx + fw - x - w, fh))
            if y > fy + EPS:
                new.append((fx, fy, fw, y - fy))
            if y + h < fy + fh - EPS:
                new.append((fx, y + h, fw, fy + fh - y - h))
        self.free = [a for i, a in enumerate(new)
                     if not any(i != j and _contains(b, a) and (not _contains(a, b) or j < i)
                                for j, b in enumerate(new))]


def _contains(a, b) -> bool:
    """Whether rectangle a contains rectangle b."""
    return (b[0] >= a[0] - EPS and b[1] >= a[1] - EPS and b[0] + b[2] <= a[0] + a[2] + EPS
            and b[1] + b[3] <= a[1] + a[3] + EPS)


def arrange(pieces: dict, bed, spacing: float) -> dict:
    """Lay out pieces ({name: mesh already in print pose}) on plates of the given bed.

    Returns {"bed_mm", "spacing_mm", "plates", "plate_pitch_mm", "pieces": {name: {"plate", "turn_deg",
    "center_xy", "footprint_mm", "fit"}}}; center_xy is the footprint center relative to its plate's center.
    """
    X, Y = float(bed[0]), float(bed[1])
    s = float(spacing)
    opts = {g: turn_options(hull_xy(m), float(m.extents[2]), bed) for g, m in pieces.items()}
    # largest first; pieces that fit nowhere last, so the plates that can be printed come first
    order = sorted(pieces, key=lambda g: (opts[g][0] == TOO_BIG, -max(w * d for _, w, d in opts[g][1])))
    plates: list[_Plate] = []
    where: dict[str, tuple[int, float]] = {}
    for g in order:
        status, options = opts[g]
        if status == TOO_BIG:
            plate = _Plate(X + s, Y + s)
            a, w, d = options[0]
            plate.used.append((g, 0.0, 0.0, w, d))
            plate.free = []
            plates.append(plate)
            where[g] = (len(plates) - 1, a)
            continue
        placed = False
        for k, plate in enumerate(plates):
            best = None
            for a, w, d in options:
                spot = plate.find(w + s, d + s)
                if spot and (best is None or spot[0] < best[0][0]):
                    best = (spot, a, w, d)
            if best:
                (_, x, y), a, w, d = best
                plate.place(x, y, w + s, d + s)
                plate.used.append((g, x, y, w, d))
                where[g] = (k, a)
                placed = True
                break
        if not placed:
            plate = _Plate(X + s, Y + s)
            a, w, d = options[0]
            plate.place(0.0, 0.0, w + s, d + s)
            plate.used.append((g, 0.0, 0.0, w, d))
            plates.append(plate)
            where[g] = (len(plates) - 1, a)

    out = {}
    for k, plate in enumerate(plates):
        lo = np.min([[x, y] for _, x, y, _, _ in plate.used], axis=0)
        hi = np.max([[x + w, y + d] for _, x, y, w, d in plate.used], axis=0)
        shift = -(lo + hi) / 2
        for g, x, y, w, d in plate.used:
            out[g] = {"plate": k + 1, "turn_deg": float(where[g][1]),
                      "center_xy": [round(x + w / 2 + shift[0], 3), round(y + d / 2 + shift[1], 3)],
                      "footprint_mm": [round(w, 2), round(d, 2)], "fit": opts[g][0]}
    return {"bed_mm": [float(v) for v in bed], "spacing_mm": s, "plates": len(plates),
            "plate_pitch_mm": X + PLATE_GAP_MM, "pieces": {g: out[g] for g in pieces}}


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
