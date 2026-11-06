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

from .files import ANALYSIS_JSON, PARTS_JSON, load_mesh, print_stl, read_json
from .printer import load_printer

DENSITY = {"PLA": 1.24, "PETG": 1.27, "ABS": 1.04, "ASA": 1.07, "TPU": 1.21}   # g/cm³
WEIGHT_NOTE = ("solid_weight_g is the upper bound at 100% infill. Actual weight drops a lot with infill "
               "(roughly 30-50% of it at 15-20% infill)")


def _analysis_summary(d: Path) -> dict:
    """What the print notes need from analysis.json (empty if it has not been written)."""
    ap = d / ANALYSIS_JSON
    if not ap.is_file():
        return {}
    from .analyze import BLOCKING
    a = read_json(ap)
    return {"warnings": [f["issue"] for f in a["findings"] if f["severity"] == "warning"],
            "unresolved": [f["issue"] for f in a["findings"] if f["severity"] in BLOCKING],
            "overhang_area_mm2": {g["group"]: g["overhang_area_mm2"] for g in a["groups"]},
            "bridges": {g["group"]: g["bridges"] for g in a["groups"]}}


def export_dir(d: str | Path) -> dict:
    d = Path(d)
    pj = read_json(d / PARTS_JSON)
    printer = load_printer(d)
    fin = d / "out" / "final"
    fin.mkdir(parents=True, exist_ok=True)
    for old in fin.glob("*"):
        old.unlink()
    groups = pj["print_orientation"]["groups"]
    labels = {p["id"]: p["label"] for p in pj["parts"]}
    dens = DENSITY.get(str(printer.get("material", "PLA")).upper(), 1.24)
    scene = trimesh.Scene()
    info = []
    for g, gi in groups.items():
        m = load_mesh(print_stl(d, g))
        stl = fin / f"{pj['model']}_{g}.stl"
        m.export(stl)
        name = g if len(groups) > 1 else pj["model"]
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
    return {
        "model": pj["model"], "title": pj["title"], "files": {"3mf": str(tmf.relative_to(d)),
                                                              "stl": [i["stl"] for i in info]},
        "printer": {k: printer[k] for k in ("name", "build_volume_mm", "nozzle_mm", "layer_height_mm", "material")},
        "groups": info, "analysis": _analysis_summary(d), "print_note": pj.get("print_note", ""),
        "note": WEIGHT_NOTE,
    }


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    print(json.dumps(export_dir(argv[0]), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
