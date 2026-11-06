"""Dimension measuring tool (for the requirements review and the main agent's self-check).
Coordinates are in the design pose, in mm.

    python -m p3d.measure <model folder>                      # bounding box, volume and position of every part
    python -m p3d.measure <model folder> --part handle        # details for one part
    python -m p3d.measure <model folder> --section z=30       # outline of the cross-section at Z=30 mm (per part)
    python -m p3d.measure <model folder> --distance a b       # shortest distance between parts a and b
    python -m p3d.measure <model folder> --ray x,y,z dx,dy,dz # solid spans a ray crosses from a point (hole/groove depth)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import trimesh

from .files import load_dir
from .meshutil import round_list


def part_info(pid, m, meta):
    lo, hi = m.bounds
    return {"id": pid, "label": meta["label"], "bbox_min": round_list(lo), "bbox_max": round_list(hi),
            "size": round_list(hi - lo), "center": round_list((lo + hi) / 2),
            "volume_mm3": round(float(m.volume), 1) if m.is_watertight else None,
            "watertight": bool(m.is_watertight), "key_dims_declared": meta.get("key_dims", {})}


def section(meshes, axis_val):
    ax, val = axis_val.split("=")
    k = "xyz".index(ax.lower())
    normal = np.eye(3)[k]
    origin = normal * float(val)
    out = {}
    for pid, m in meshes.items():
        s = m.section(plane_origin=origin, plane_normal=normal)
        if s is None:
            continue
        pts = s.vertices
        lo, hi = pts.min(0), pts.max(0)
        try:
            planar, _ = s.to_2D()
            area = float(planar.area)
            n_loops = len(planar.polygons_full)
            holes = sum(len(p.interiors) for p in planar.polygons_full)
        except Exception:
            area, n_loops, holes = None, None, None
        out[pid] = {"bbox_min": round_list(lo), "bbox_max": round_list(hi), "size": round_list(hi - lo),
                    "area_mm2": round(area, 1) if area else None, "regions": n_loops, "holes": holes}
    return out


def distance(meshes, a, b):
    """Shortest distance from part a's surface (sampled) to part b."""
    pa, _ = trimesh.sample.sample_surface_even(meshes[a], 4000)
    _, dist, _ = trimesh.proximity.closest_point(meshes[b], pa)
    k = int(np.argmin(dist))
    return {"a": a, "b": b, "min_distance_mm": round(float(dist[k]), 3), "at": round_list(pa[k])}


def overall(pj, meshes, meta):
    lo, hi = trimesh.util.concatenate(list(meshes.values())).bounds
    return {"model": pj["model"], "overall_size": round_list(hi - lo), "overall_min": round_list(lo),
            "overall_max": round_list(hi),
            "parts": [part_info(pid, m, meta[pid]) for pid, m in meshes.items()]}


def _args_after(argv, flag, n=1):
    """The n values that follow flag on the command line."""
    i = argv.index(flag)
    return [argv[i + 1 + k] for k in range(n)]


def ray(meshes, origin, direction):
    o = np.array([float(v) for v in origin.split(",")])
    dvec = np.array([float(v) for v in direction.split(",")])
    dvec = dvec / np.linalg.norm(dvec)
    out = {}
    for pid, m in meshes.items():
        locs, _, _ = m.ray.intersects_location([o], [dvec], multiple_hits=True)
        if len(locs):
            t = np.sort(np.dot(locs - o, dvec))
            out[pid] = {"hits_at_mm": round_list(t, 2),
                        "solid_spans_mm": [round(float(t[i + 1] - t[i]), 2) for i in range(0, len(t) - 1, 2)]}
    return out


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    d = Path(argv[0])
    pj, meshes = load_dir(d)
    meta = {p["id"]: p for p in pj["parts"]}
    if "--part" in argv:
        pid, = _args_after(argv, "--part")
        res = part_info(pid, meshes[pid], meta[pid])
    elif "--section" in argv:
        res = section(meshes, *_args_after(argv, "--section"))
    elif "--distance" in argv:
        res = distance(meshes, *_args_after(argv, "--distance", 2))
    elif "--ray" in argv:
        res = ray(meshes, *_args_after(argv, "--ray", 2))
    else:
        res = overall(pj, meshes, meta)
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
