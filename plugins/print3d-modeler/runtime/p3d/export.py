"""Write the final print files (in print orientation, resting on the bed).

    python -m p3d.export <model folder>

Outputs:
  out/final/<model>.3mf           3MF with every piece laid out on the bed (one object per piece)
  out/final/<model>_<group>.stl   one STL per piece
Stdout: JSON with the facts needed to write the print notes (print-notes.md)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import trimesh

from .printer import load_printer

DENSITY = {"PLA": 1.24, "PETG": 1.27, "ABS": 1.04, "ASA": 1.07, "TPU": 1.21}


def export_dir(d: str | Path) -> dict:
    d = Path(d)
    pj = json.loads((d / "parts.json").read_text(encoding="utf-8"))
    printer = load_printer(d)
    fin = d / "out" / "final"
    fin.mkdir(parents=True, exist_ok=True)
    for old in fin.glob("*"):
        old.unlink()
    scene = trimesh.Scene()
    info = []
    labels = {p["id"]: p["label"] for p in pj["parts"]}
    dens = DENSITY.get(str(printer.get("material", "PLA")).upper(), 1.24)
    for g, gi in pj["print_orientation"]["groups"].items():
        m = trimesh.load_mesh(d / "out" / "print" / f"{g}.stl", process=True)
        stl = fin / f"{pj['model']}_{g}.stl"
        m.export(stl)
        name = g if len(pj["print_orientation"]["groups"]) > 1 else pj["model"]
        scene.add_geometry(m, node_name=name, geom_name=name)
        vol = float(m.volume) if m.is_watertight else None
        info.append({
            "group": g, "parts": [f"{labels[p]} ({p})" for p in gi["parts"]],
            "stl": str(stl.relative_to(d)), "rotation_deg": gi["rotation_deg"], "bed_face": gi.get("bed_face", ""),
            "size_mm": [round(float(v), 1) for v in m.extents], "min_z": round(float(m.bounds[0][2]), 3),
            "volume_cm3": round(vol / 1000, 2) if vol else None,
            "solid_weight_g": round(vol / 1000 * dens, 1) if vol else None,
        })
    tmf = fin / f"{pj['model']}.3mf"
    scene.export(tmf)
    an = {}
    ap = d / "analysis.json"
    if ap.is_file():
        a = json.loads(ap.read_text(encoding="utf-8"))
        an = {"warnings": [f["issue"] for f in a["findings"] if f["severity"] == "warning"],
              "unresolved": [f["issue"] for f in a["findings"] if f["severity"] in ("critical", "major")],
              "overhang_area_mm2": {g["group"]: g["overhang_area_mm2"] for g in a["groups"]},
              "bridges": {g["group"]: g["bridges"] for g in a["groups"]}}
    return {
        "model": pj["model"], "title": pj["title"], "files": {"3mf": str(tmf.relative_to(d)),
                                                              "stl": [i["stl"] for i in info]},
        "printer": {k: printer[k] for k in ("name", "build_volume_mm", "nozzle_mm", "layer_height_mm", "material")},
        "groups": info, "analysis": an, "print_note": pj.get("print_note", ""),
        "note": "solid_weight_g is the upper bound at 100% infill. Actual weight drops a lot with infill "
                "(roughly 30-50% of it at 15-20% infill)",
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    print(json.dumps(export_dir(sys.argv[1]), ensure_ascii=False, indent=2))
