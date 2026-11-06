"""寸法の実測ツール（要望充足レビューやメインの自己確認用）。座標は設計姿勢・mm。

    python -m p3d.measure <モデルフォルダ>                      # 全部位の外形・体積・位置
    python -m p3d.measure <モデルフォルダ> --part handle        # 1 部位の詳細
    python -m p3d.measure <モデルフォルダ> --section z=30       # 高さ 30mm の断面の外形寸法（部位ごと）
    python -m p3d.measure <モデルフォルダ> --distance a b       # 部位 a と b の最短距離
    python -m p3d.measure <モデルフォルダ> --ray x,y,z dx,dy,dz # 点から方向へ飛ばしたレイが通る厚み（穴・溝の深さ確認）
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import trimesh

from .analyze import load_dir
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
        pid = argv[argv.index("--part") + 1]
        res = part_info(pid, meshes[pid], meta[pid])
    elif "--section" in argv:
        res = section(meshes, argv[argv.index("--section") + 1])
    elif "--distance" in argv:
        i = argv.index("--distance")
        a, b = argv[i + 1], argv[i + 2]
        pa, _ = trimesh.sample.sample_surface_even(meshes[a], 4000)
        _, dist, _ = trimesh.proximity.closest_point(meshes[b], pa)
        k = int(np.argmin(dist))
        res = {"a": a, "b": b, "min_distance_mm": round(float(dist[k]), 3), "at": round_list(pa[k])}
    elif "--ray" in argv:
        i = argv.index("--ray")
        res = ray(meshes, argv[i + 1], argv[i + 2])
    else:
        allm = trimesh.util.concatenate(list(meshes.values()))
        lo, hi = allm.bounds
        res = {"model": pj["model"], "overall_size": round_list(hi - lo), "overall_min": round_list(lo),
               "overall_max": round_list(hi),
               "parts": [part_info(pid, m, meta[pid]) for pid, m in meshes.items()]}
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
