"""Automatic printability measurements (FDM).

    python -m p3d.analyze <model folder>            # write analysis.json and print a summary
    python -m p3d.analyze <model folder> --stdout   # print the JSON without writing a file (for reviewers)

Inputs: parts.json, out/parts/<id>.stl (design pose), printer.json (optional)
Checks: watertightness, body count, build volume, minimum wall thickness, overhangs, bridges,
        bed contact area and center of mass, clearance between pieces, alternative print orientations
Every position is reported in design-pose coordinates (the coordinates the user sees).
"""
from __future__ import annotations

import json
import logging
import math
import sys
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import trimesh

from .files import ANALYSIS_JSON, load_dir, write_json
from .meshutil import boolean, direction_label, fuse, np_default, place_on_bed, round_list, transformed
from .printer import load_printer

__all__ = ["analyze_dir", "group_overlays", "load_dir", "BLOCKING", "SEVERITY_RANK"]

BED_EPS = 0.2           # downward faces at or below this Z count as touching the bed
MIN_REGION_MM2 = 2.0    # ignore overhang regions smaller than this (edges of fillets, etc.)
THICK_SAMPLES = 6000
SUPPORT_GAP_MM = 0.3    # a downward face with other geometry within this distance below it counts as supported
MAX_REGIONS = 12        # overhang regions reported per piece (largest first)
CLEARANCE_SAMPLES = 6000
TOUCH_MM = 0.005        # surface samples closer than this count as touching

SEVERITY_RANK = {"critical": 0, "major": 1, "warning": 2, "info": 3}
BLOCKING = ("critical", "major")   # severities that make the automatic check FAIL

logging.getLogger("trimesh").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", category=RuntimeWarning)

AXIS_CANDIDATES = {
    "as designed": [0, 0, 0],
    "upside down": [180, 0, 0],
    "front face down": [-90, 0, 0],
    "back face down": [90, 0, 0],
    "right face down": [0, 90, 0],
    "left face down": [0, -90, 0],
}


# --------------------------------------------------------------------- geometry helpers
def supported_mask(mesh, faces, others=None, gap=SUPPORT_GAP_MM):
    """Which of the downward faces are supported by something directly below them.

    - another face of the fused shape lies within gap directly below (stacked, almost touching)
    - the point just below the face is inside another part in others (parts overlap and are fused)
    """
    faces = np.asarray(faces, dtype=int)
    out = np.zeros(len(faces), dtype=bool)
    if len(faces) == 0:
        return out
    probe = mesh.triangles_center[faces] - np.array([0.0, 0.0, 0.02])
    down = np.tile([0.0, 0.0, -1.0], (len(faces), 1))
    try:
        locs, ridx, tidx = mesh.ray.intersects_location(probe, down, multiple_hits=False)
        ok = tidx != faces[ridx]
        dist = probe[ridx, 2] - locs[:, 2]
        out[ridx[ok & (dist <= gap)]] = True
    except Exception:
        pass
    for o in others or []:
        rest = ~out
        if not rest.any() or not o.is_watertight:
            continue
        try:
            out[np.nonzero(rest)[0][o.contains(probe[rest])]] = True
        except Exception:
            pass
    return out


def overhang_mask(mesh, limit_deg, others=None):
    """Faces pointing down more than limit_deg from vertical, excluding bed contact and faces supported from below."""
    nz = mesh.face_normals[:, 2]
    zc = mesh.triangles_center[:, 2]
    cand = (nz < -math.cos(math.radians(limit_deg))) & (zc > BED_EPS)
    idx = np.nonzero(cand)[0]
    cand[idx[supported_mask(mesh, idx, others)]] = False
    return cand


def bed_mask(mesh):
    return (mesh.face_normals[:, 2] < -0.99) & (mesh.triangles_center[:, 2] <= BED_EPS)


def regions(mesh, mask):
    """Split the masked faces into edge-connected regions."""
    idx = np.nonzero(mask)[0]
    if len(idx) == 0:
        return []
    sub = mesh.submesh([idx], append=True, repair=False)
    comps = trimesh.graph.connected_components(sub.face_adjacency, nodes=np.arange(len(sub.faces)),
                                               min_len=1)
    out = []
    for c in comps:
        c = np.asarray(c)
        w = sub.area_faces[c]
        out.append({"faces": c, "area": float(w.sum()),
                    "center": (sub.triangles_center[c] * w[:, None]).sum(0) / max(w.sum(), 1e-9),
                    "normal": (sub.face_normals[c] * w[:, None]).sum(0), "mesh": sub})
    return sorted(out, key=lambda r: -r["area"])


def short_side(mesh, faces):
    """Short side of a face region projected onto XY (approximate bridge length)."""
    pts = mesh.triangles[faces].reshape(-1, 3)[:, :2]
    if len(pts) < 3:
        return 0.0
    try:
        _, ext = trimesh.bounds.oriented_bounds_2D(pts)   # minimum-area bounding rectangle
    except Exception:
        ext = pts.max(0) - pts.min(0)
    return float(np.min(ext))


def wall_thickness(mesh, n=THICK_SAMPLES, seed=0):
    """Cast rays inward from surface points; the distance to the opposite face is the local wall thickness."""
    if len(mesh.faces) == 0:
        return np.zeros(0), np.zeros((0, 3))
    rng = np.random.default_rng(seed)
    pts, fidx = trimesh.sample.sample_surface_even(mesh, n, seed=int(rng.integers(1 << 30)))
    if len(pts) == 0:
        pts, fidx = trimesh.sample.sample_surface(mesh, n)
    normals = mesh.face_normals[fidx]
    origins = pts - normals * 1e-3
    try:
        locs, ray_idx, tri_idx = mesh.ray.intersects_location(origins, -normals, multiple_hits=False)
    except Exception:
        return np.zeros(0), np.zeros((0, 3))
    thick = np.full(len(pts), np.inf)
    dist = np.linalg.norm(locs - origins[ray_idx], axis=1)
    ok = tri_idx != fidx[ray_idx]       # ignore hits on the starting face itself
    thick[ray_idx[ok]] = dist[ok]
    finite = np.isfinite(thick)
    return thick[finite], pts[finite]


def nearest_part(point, part_meshes: dict) -> str | None:
    best, bid = np.inf, None
    for pid, m in part_meshes.items():
        _, dist, _ = trimesh.proximity.closest_point(m, [point])
        if dist[0] < best:
            best, bid = float(dist[0]), pid
    return bid


def com_inside_contact(mesh) -> tuple[bool, float]:
    bm = bed_mask(mesh)
    area = float(mesh.area_faces[bm].sum())
    if area <= 0:
        return False, 0.0
    pts = mesh.triangles[bm].reshape(-1, 3)[:, :2]
    com = mesh.center_mass if mesh.is_watertight else mesh.centroid
    try:
        from scipy.spatial import ConvexHull, Delaunay
        hull = ConvexHull(pts)
        inside = Delaunay(pts[hull.vertices]).find_simplex(com[:2]) >= 0
    except Exception:
        lo, hi = pts.min(0), pts.max(0)
        inside = bool(np.all(com[:2] >= lo) and np.all(com[:2] <= hi))
    return bool(inside), area


def fits(size, vol):
    a, b, h = size
    X, Y, Z = vol
    return h <= Z and ((a <= X and b <= Y) or (a <= Y and b <= X))


def posed_overhang_mask(pm, design_parts, M, limit_deg):
    """Overhang mask of pm, a fused piece already moved by M. Faces held up by an overlapping part do not count."""
    return overhang_mask(pm, limit_deg, [transformed(m, M) for m in design_parts])


# --------------------------------------------------------------------- viewer overlays
def group_overlays(pj, part_meshes, limit_deg):
    """For the viewer: per group, the triangles needing support and touching the bed (design-pose coordinates)."""
    out = {}
    for g, gi in pj["print_orientation"]["groups"].items():
        M = np.array(gi["matrix"], dtype=float)
        design_parts = [part_meshes[p] for p in gi["parts"]]
        fused = fuse(design_parts)
        pm = transformed(fused, M)
        om = posed_overhang_mask(pm, design_parts, M, limit_deg)
        out[g] = {"overhang": np.round(fused.triangles[om], 3).ravel().tolist(),
                  "contact": np.round(fused.triangles[bed_mask(pm)], 3).ravel().tolist()}
    return out


# --------------------------------------------------------------------- findings
class Findings(list):
    """Collected findings. Each one is a dict with a fixed key order (written to analysis.json as is)."""

    def add(self, severity, issue, *, check, part=None, direction=None, evidence="", suggestion="", location=None):
        self.append({"severity": severity, "check": check, "part": part, "direction": direction,
                     "issue": issue, "evidence": evidence, "suggestion": suggestion,
                     "location": round_list(location, 2) if location is not None else None})


@dataclass
class Limits:
    """Thresholds taken from the printer settings."""
    printer: dict

    def __post_init__(self):
        p = self.printer
        self.nozzle = float(p["nozzle_mm"])
        self.min_wall = 2 * self.nozzle
        self.overhang_deg = float(p["overhang_limit_deg"])
        self.max_bridge = float(p["max_bridge_mm"])
        self.volume = p["build_volume_mm"]
        self.min_contact = float(p["min_bed_contact_mm2"])
        self.clearance = p["clearance_mm"]

    def as_dict(self):
        return {"min_wall_mm": self.min_wall, "min_feature_mm": self.nozzle, "overhang_limit_deg": self.overhang_deg,
                "max_bridge_mm": self.max_bridge, "clearance_mm": self.clearance}


class GroupPose:
    """One print_group (piece): its fused mesh in design pose and in print pose, with converters back to design pose."""

    def __init__(self, name, ginfo, part_meshes):
        self.name = name
        self.info = ginfo
        self.part_ids = ginfo["parts"]
        self.parts = {p: part_meshes[p] for p in self.part_ids}     # design pose
        self.fused = fuse(list(self.parts.values()))
        self.M = np.array(ginfo["matrix"], dtype=float)
        self.Minv = np.linalg.inv(self.M)
        self.pm = transformed(self.fused, self.M)                    # print pose

    def to_design(self, pt):
        return (self.Minv @ np.r_[pt, 1.0])[:3]

    def dir_design(self, vec):
        return direction_label(self.Minv[:3, :3] @ np.asarray(vec))

    def nearest_part(self, pt_design):
        return nearest_part(pt_design, self.parts)


# --------------------------------------------------------------------- checks per piece
def _check_mesh(gp: GroupPose, bodies: int, f: Findings):
    g = gp.name
    # 1. watertight
    if not gp.pm.is_watertight:
        bad = [p for p in gp.part_ids if not gp.parts[p].is_watertight]
        f.add("critical", f"[{g}] The mesh is not closed (it has holes or flipped faces)", part=bad[0] if bad else None,
              evidence=f"is_watertight=False, open parts={bad}", check="watertight",
              suggestion="Overlap solids by 0.5-1 mm so they fuse / check that 2D sketch outlines are closed")
    # 2. body count
    if bodies > 1:
        f.add("critical", f"[{g}] A piece printed in one go is split into {bodies} bodies (some part is floating)",
              evidence=f"split() bodies={bodies}", check="bodies",
              suggestion="Overlap the parts by about 1 mm. If they are printed separately, use separate print_groups")


def _check_build_volume(gp: GroupPose, lim: Limits, f: Findings) -> bool:
    size, vol = gp.pm.extents, lim.volume
    ok = fits(size, vol)
    if not ok:
        f.add("critical", f"[{gp.name}] Does not fit the build volume {vol[0]}×{vol[1]}×{vol[2]} mm ({size[0]:.1f}×{size[1]:.1f}×{size[2]:.1f} mm)",
              evidence=f"printer={lim.printer['name']}", check="build_volume",
              suggestion="Change the print orientation / split it into separate print_groups / scale it down")
    return ok


def _check_bed_contact(gp: GroupPose, lim: Limits, f: Findings) -> tuple[bool, float]:
    g = gp.name
    inside, contact = com_inside_contact(gp.pm)
    if contact <= 0:
        f.add("critical", f"[{g}] No flat face touches the bed", check="bed_contact",
              suggestion="Add a flat bottom face / change the print orientation")
    elif contact < lim.min_contact or not inside:
        f.add("major", f"[{g}] The bed contact is small or the center of mass is outside it, so it may tip over or detach while printing",
              evidence=f"contact area={contact:.1f}mm², center of mass inside contact={inside}", check="bed_contact",
              suggestion="Widen the contact area / add a brim / change the print orientation")
    return inside, contact


def _check_overhangs(gp: GroupPose, lim: Limits, f: Findings) -> tuple[float, list, list]:
    """Overhang regions and bridges. Returns (total overhang area, regions, bridges)."""
    g, limit, max_bridge = gp.name, lim.overhang_deg, lim.max_bridge
    pm = gp.pm
    om = posed_overhang_mask(pm, list(gp.parts.values()), gp.M, limit)
    regs = [r for r in regions(pm, om) if r["area"] >= MIN_REGION_MM2]
    items, bridges = [], []
    for r in regs[:MAX_REGIONS]:
        c_design = gp.to_design(r["center"])
        part = gp.nearest_part(c_design)
        n = r["normal"] / max(np.linalg.norm(r["normal"]), 1e-9)
        is_flat = n[2] < -0.98
        span = short_side(r["mesh"], r["faces"]) if is_flat else None
        item = {"part": part, "area_mm2": round(r["area"], 1), "center": round_list(c_design),
                "facing": gp.dir_design(n), "flat": bool(is_flat),
                "bridge_span_mm": round(span, 1) if span is not None else None}
        items.append(item)
        if is_flat and span is not None and span <= max_bridge:
            bridges.append(item)
            continue   # short bridges usually print without support (info only)
        if is_flat:
            f.add("warning", f"[{g}] A downward horizontal face (short side {span:.1f} mm) exceeds the {max_bridge:g} mm bridge limit. Needs support",
                  part=part, direction=item["facing"], location=c_design, check="bridge",
                  evidence=f"area={r['area']:.1f}mm², short side={span:.1f}mm",
                  suggestion="Add support / use a 45° chamfer or an arch / change the orientation")
        else:
            f.add("warning", f"[{g}] Overhang beyond {limit:g}° (area {r['area']:.0f} mm²). Needs support",
                  part=part, direction=item["facing"], location=c_design, check="overhang",
                  evidence=f"area={r['area']:.1f}mm²",
                  suggestion="Add support / chamfer it to 45° or less / change the orientation")
    return round(sum(r["area"] for r in regs), 1), items, bridges


def _check_walls(gp: GroupPose, lim: Limits, f: Findings) -> dict:
    """Wall thickness and fine detail. Returns the measurements for the group result."""
    th, pts = wall_thickness(gp.pm)
    if not len(th):
        return {}
    min_wall, nozzle = lim.min_wall, lim.nozzle
    thin = th < min_wall
    res = {"min_wall_mm": round(float(th.min()), 2), "wall_p01_mm": round(float(np.percentile(th, 1)), 2),
           "thin_samples": int(thin.sum())}
    if thin.sum() < 3:
        return res
    by_part: dict[str, list] = {}       # thin spots grouped by part
    for t, p in zip(th[thin], pts[thin]):
        pd = gp.to_design(p)
        by_part.setdefault(gp.nearest_part(pd), []).append((t, pd))
    for part, items in by_part.items():
        if len(items) < 3:
            continue
        tmin, ploc = min(items, key=lambda x: x[0])
        what = "Too fine to print" if tmin < nozzle else "Wall too thin"
        f.add("major", f"[{gp.name}] {what} (minimum {tmin:.2f} mm, needs {min_wall:.1f} mm or more)",
              part=part, location=ploc, check="wall_thickness",
              evidence=f"{len(items)} thickness samples below {min_wall:.1f}mm, minimum {tmin:.2f}mm",
              suggestion=f"Thicken to {min_wall:.1f} mm or more (ideally {min_wall * 1.5:.1f} mm)")
    return res


def _orientation_candidates(gp: GroupPose, lim: Limits) -> list:
    """The six axis-aligned orientations, best first (fits, has bed contact, least overhang)."""
    cands = []
    for name, rot in AXIS_CANDIDATES.items():
        cm, Mc = place_on_bed(gp.fused, rot)
        om = posed_overhang_mask(cm, list(gp.parts.values()), Mc, lim.overhang_deg)
        _, ca = com_inside_contact(cm)
        cands.append({"name": name, "rotation_deg": rot, "overhang_area_mm2": round(float(cm.area_faces[om].sum()), 1),
                      "bed_contact_area_mm2": round(ca, 1), "height_mm": round(float(cm.extents[2]), 1),
                      "fits": fits(cm.extents, lim.volume)})
    cands.sort(key=lambda c: (not c["fits"], c["bed_contact_area_mm2"] <= 0, c["overhang_area_mm2"]))
    return cands


def _check_orientation(gp: GroupPose, current_overhang: float, cands: list, f: Findings):
    best = cands[0]
    if best["fits"] and best["bed_contact_area_mm2"] > 0 and current_overhang > best["overhang_area_mm2"] * 1.5 + 50:
        f.add("warning", f"[{gp.name}] Printing \"{best['name']}\" (rotation {best['rotation_deg']}) would likely need less support",
              check="orientation",
              evidence=f"overhang area now {current_overhang:.0f}mm² -> {best['overhang_area_mm2']:.0f}mm²",
              suggestion="Decide with the user, also weighing visible faces (layer lines, support marks) and strength direction")


def _analyze_group(gp: GroupPose, lim: Limits, f: Findings) -> dict:
    pm = gp.pm
    bodies = len(pm.split(only_watertight=False)) if len(pm.faces) else 0
    gres = {"group": gp.name, "parts": gp.part_ids, "rotation_deg": gp.info["rotation_deg"],
            "bed_face": gp.info.get("bed_face", ""), "size_mm": round_list(pm.extents),
            "watertight": bool(pm.is_watertight), "bodies": bodies,
            "volume_mm3": round(float(pm.volume), 1) if pm.is_watertight else None}
    _check_mesh(gp, bodies, f)
    gres["fits_build_volume"] = _check_build_volume(gp, lim, f)
    inside, contact = _check_bed_contact(gp, lim, f)
    gres["bed_contact_area_mm2"] = round(contact, 1)
    gres["com_inside_contact"] = inside
    area, regs, bridges = _check_overhangs(gp, lim, f)
    gres["overhang_area_mm2"] = area
    gres["overhang_regions"] = regs
    gres["bridges"] = bridges
    gres.update(_check_walls(gp, lim, f))
    gres["orientation_candidates"] = _orientation_candidates(gp, lim)
    _check_orientation(gp, area, gres["orientation_candidates"], f)
    return gres


# --------------------------------------------------------------------- clearance between pieces
def _check_clearances(poses: list[GroupPose], part_meshes, lim: Limits, f: Findings) -> list:
    """Pieces printed separately and assembled: overlap and too-tight gaps in the assembled (design) position."""
    lo_c, hi_c = lim.clearance
    out = []
    for i, ga in enumerate(poses):
        for gb in poses[i + 1:]:
            a, b, A, B = ga.name, gb.name, ga.fused, gb.fused
            inter = boolean([A, B], "intersection")
            iv = float(inter.volume) if inter is not None and len(inter.faces) else 0.0
            pa, _ = trimesh.sample.sample_surface_even(A, CLEARANCE_SAMPLES)
            _, dist, _ = trimesh.proximity.closest_point(B, pa)
            tight = (dist > TOUCH_MM) & (dist < lo_c)
            gap = float(dist[tight].min()) if tight.any() else None
            k = int(np.argmin(np.where(tight, dist, np.inf))) if tight.any() else None
            out.append({"a": a, "b": b, "touching_samples": int((dist <= TOUCH_MM).sum()),
                        "tight_gap_mm": round(gap, 3) if gap is not None else None,
                        "tight_samples": int(tight.sum()), "overlap_mm3": round(iv, 2)})
            if iv > 0.01:
                f.add("major", f"Pieces {a} and {b} overlap in the assembled position ({iv:.1f} mm³)",
                      part=None, check="clearance", evidence=f"intersection volume={iv:.2f}mm³",
                      suggestion=f"Leave a {lo_c}-{hi_c} mm gap where they fit together")
            elif tight.sum() >= 5:
                f.add("major", f"The gap between pieces {a} and {b} is only {gap:.2f} mm, so they may not fit (target {lo_c}-{hi_c} mm)",
                      location=pa[k], part=nearest_part(pa[k], part_meshes), check="clearance",
                      evidence=f"{int(tight.sum())} gap samples below {lo_c}mm, minimum {gap:.3f}mm",
                      suggestion=f"Widen the gap to {lo_c}-{hi_c} mm (per side)")
    return out


# --------------------------------------------------------------------- main analysis
def analyze_dir(d: str | Path, write: bool = True) -> dict:
    d = Path(d)
    pj, part_meshes = load_dir(d)
    printer = load_printer(d)
    lim = Limits(printer)
    findings = Findings()

    poses = [GroupPose(g, gi, part_meshes) for g, gi in pj["print_orientation"]["groups"].items()]
    groups_out = [_analyze_group(gp, lim, findings) for gp in poses]
    clearances = _check_clearances(poses, part_meshes, lim, findings) if len(poses) > 1 else []

    findings.sort(key=lambda x: SEVERITY_RANK[x["severity"]])
    allb = trimesh.util.concatenate(list(part_meshes.values())).bounds
    result = {
        "printer": printer,
        "summary": {
            "size_mm": round_list(allb[1] - allb[0], 1),
            "groups": len(groups_out),
            "verdict_hint": "FAIL" if any(x["severity"] in BLOCKING for x in findings) else "PASS",
            "counts": {s: sum(x["severity"] == s for x in findings) for s in SEVERITY_RANK},
        },
        "groups": groups_out,
        "clearances": clearances,
        "findings": list(findings),
        "thresholds": lim.as_dict(),
    }
    if write:
        write_json(d / ANALYSIS_JSON, result, default=np_default)
    return result


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    d = Path(argv[0])
    to_stdout = "--stdout" in argv
    res = analyze_dir(d, write=not to_stdout)
    if to_stdout:
        print(json.dumps(res, ensure_ascii=False, indent=2, default=np_default))
    else:
        s = res["summary"]
        print(f"Auto check: {s['verdict_hint']}  {s['counts']}  size {s['size_mm']} mm")
        for f in res["findings"]:
            print(f"- [{f['severity']}] {f['issue']}" + (f" (part: {f['part']})" if f["part"] else ""))
        print(f"-> {d / ANALYSIS_JSON}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
