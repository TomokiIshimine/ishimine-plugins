"""Write the final print files (in print orientation, resting on the bed).

    python -m p3d.export <model folder>

Outputs:
  out/final/<model>.3mf           3MF with every piece laid out on the printer's bed (one object per piece)
  out/final/<model>_plate<N>.3mf  instead of the above when the pieces need more than one plate (one file per plate)
  out/final/<model>_<group>.stl   one STL per piece, placed where it sits on its plate
Stdout: JSON with the facts needed to write the print notes (print-notes.md), including `layout`

Positions in the files are bed coordinates as slicers use them: the bed's front-left corner is (0, 0),
X runs to the right and Y to the back, so a 3MF opened as a project keeps the layout made by LabeledModel.build.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import trimesh

from .layout import is_current
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


def _layout_status(pj: dict, printer: dict) -> dict:
    """Whether parts.json was laid out for the current printer, and its plate count."""
    lay = pj.get("print_layout")
    vol = [float(v) for v in printer["build_volume_mm"]]
    current = is_current(lay, printer)
    return {"plates": lay["plates"] if lay else 1, "pitch": lay["plate_pitch_mm"] if lay else 0.0,
            "bed": [float(v) for v in lay["bed_mm"]] if lay else vol, "current": current,
            "made_for": lay["printer"] if lay else None}


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
    X, Y, Z = (float(v) for v in printer["build_volume_mm"])
    lay = _layout_status(pj, printer)
    scenes: dict[int, trimesh.Scene] = {}
    info = []
    for g, gi in groups.items():
        m = load_mesh(print_stl(d, g))
        plate = int(gi.get("plate", 1))
        # plate-centered coordinates (center of plate 1 at 0, 0) -> slicer bed coordinates (front-left corner at 0, 0),
        # using the bed the layout was made for (the same as the printer's unless the layout is stale)
        T = np.eye(4)
        T[:3, 3] = [lay["bed"][0] / 2 - (plate - 1) * lay["pitch"], lay["bed"][1] / 2, 0.0]
        m.apply_transform(T)
        stl = fin / f"{pj['model']}_{g}.stl"
        m.export(stl)
        name = g if len(groups) > 1 else pj["model"]
        scenes.setdefault(plate, trimesh.Scene()).add_geometry(m, node_name=name, geom_name=name)
        lo, hi = m.bounds
        on_bed = bool(lo[0] >= -0.01 and lo[1] >= -0.01 and hi[0] <= X + 0.01 and hi[1] <= Y + 0.01 and hi[2] <= Z + 0.01)
        vol = float(m.volume) if m.is_watertight else None
        info.append({
            "group": g, "parts": [f"{labels[p]} ({p})" for p in gi["parts"]],
            "stl": str(stl.relative_to(d)), "rotation_deg": gi["rotation_deg"], "bed_face": gi.get("bed_face", ""),
            "plate": plate, "bed_turn_deg": gi.get("bed_turn_deg", 0), "fits_bed": on_bed,
            "position_mm": [round(float(v), 1) for v in (lo + hi) / 2][:2],
            "size_mm": [round(float(v), 1) for v in m.extents], "min_z": round(float(m.bounds[0][2]), 3),
            "volume_cm3": round(vol / 1000, 2) if vol else None,
            "solid_weight_g": round(vol / 1000 * dens, 1) if vol else None,
        })
    tmfs = []
    for plate in sorted(scenes):
        suffix = f"_plate{plate}" if len(scenes) > 1 else ""
        tmf = fin / f"{pj['model']}{suffix}.3mf"
        scenes[plate].export(tmf)
        tmfs.append(str(tmf.relative_to(d)))
    warnings = []
    if not lay["current"]:
        warnings.append(f"The layout was made for {lay['made_for'] or 'an older version'}, not for {printer['name']}: "
                        "run model.py again before printing")
    if len(scenes) > 1:
        warnings.append(f"The pieces do not fit on one plate of {printer['name']} ({X:g}×{Y:g} mm): "
                        f"{len(scenes)} print runs, one 3MF per plate")
    warnings += [f"Piece {i['group']} does not fit the build volume of {printer['name']} ({X:g}×{Y:g}×{Z:g} mm)"
                 for i in info if not i["fits_bed"]]
    return {
        "model": pj["model"], "title": pj["title"], "files": {"3mf": tmfs, "stl": [i["stl"] for i in info]},
        "printer": {k: printer[k] for k in ("name", "build_volume_mm", "nozzle_mm", "layer_height_mm", "material")},
        "layout": {"plates": len(scenes), "made_for_current_printer": lay["current"], "warnings": warnings},
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
