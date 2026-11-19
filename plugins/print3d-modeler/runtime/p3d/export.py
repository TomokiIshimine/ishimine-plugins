"""Write the final print files (in print orientation, resting on the bed).

    python -m p3d.export <model folder> [--material <filament>=<material> ...]

--material decides or changes a filament's material at export time without rebuilding the model
(such as --material text=PETG). Materials: PLA, PLA Matte, PLA Silk, PETG, ABS, ASA, TPU.

Outputs:
  out/final/<model>.3mf           Bambu Lab printers (p3d.bambu): one Bambu Studio / OrcaSlicer project with every plate,
                                  each piece on its plate, and the printer, process and filament presets selected
                                  other printers: plain 3MF with every piece laid out on the bed (one object per piece)
  out/final/<model>_plate<N>.3mf  other printers only, instead of <model>.3mf when the pieces need more than one plate
                                  (plain 3MF has no plates, so one file per plate)
  out/final/<model>_<group>.stl   one STL per piece, placed where it sits on its plate
  out/final/<model>_<group>_<filament>.stl  multi-color pieces only: the part of the piece printed with that filament
Stdout: JSON with the facts needed to write the print notes (print-notes.md), including `layout`, `print_settings`
(the settings from set_print_settings, the bed type and what went into the 3MF), `format_check` (p3d.check3mf on every
3MF written; do not hand over files whose check failed) and, for models with filaments, `filaments` (number in the
slicer, color, material, preset, weight)

Print settings (LabeledModel.set_print_settings, p3d.print_settings): Bambu Lab printers get them in the project
(model-wide ones as changes to the process preset, a piece's own ones on that object) together with the bed type;
other printers' 3MF files carry no slicer settings, so they go into the print notes only.

Multi-color models (parts on two or more filaments, see p3d.filament): each piece is one object made of one part per
filament. Bambu Lab printers get the filaments' colors and presets in the project (Bambu Studio maps them to the AMS
when the job is sent); other printers get a 3MF whose parts carry the filament colors as 3MF base materials.

Positions in the files are bed coordinates as slicers use them: the bed's front-left corner is (0, 0),
X runs to the right and Y to the back, so the layout made by LabeledModel.build is kept. In a Bambu Studio project
each plate is shifted to where Bambu Studio draws that plate (see p3d.bambu).
"""
from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

import numpy as np
import trimesh

from . import print_settings as ps
from .bambu import filament_preset, project_for, write_project
from .check3mf import check_file
from .filament import density, normalize_material, used_filaments
from .layout import is_current
from .files import ANALYSIS_JSON, PARTS_JSON, load_mesh, print_filament_stl, print_stl, read_json
from .printer import load_printer

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
            "bridges": {g["group"]: g["bridges"] for g in a["groups"]},
            **({"filaments": a["filaments"]} if a.get("filaments") else {})}


def _layout_status(pj: dict, printer: dict) -> dict:
    """Whether parts.json was laid out for the current printer, and its plate count."""
    lay = pj.get("print_layout")
    vol = [float(v) for v in printer["build_volume_mm"]]
    current = is_current(lay, printer)
    return {"plates": lay["plates"] if lay else 1, "pitch": lay["plate_pitch_mm"] if lay else 0.0,
            "bed": [float(v) for v in lay["bed_mm"]] if lay else vol, "current": current,
            "made_for": lay["printer"] if lay else None}


def _filaments(pj: dict, printer: dict, materials: dict | None) -> list[dict]:
    """The model's filaments with export-time materials applied: slot (1..N), material actually used, decided or not."""
    fl = used_filaments(pj)
    materials = dict(materials or {})
    unknown = set(materials) - {f["id"] for f in fl}
    if unknown:
        raise ValueError(f"--material names filaments the model does not use: {', '.join(sorted(unknown))} "
                         f"(filaments: {', '.join(f['id'] for f in fl) or 'none'})")
    try:
        fallback = normalize_material(printer.get("material")) or "PLA"
    except ValueError:
        fallback = "PLA"
    out = []
    for i, f in enumerate(fl):
        chosen = normalize_material(materials[f["id"]]) if f["id"] in materials else f.get("material")
        out.append({"filament": i + 1, "id": f["id"], "label": f["label"], "color": f["color"],
                    "material": chosen or fallback, "material_decided": chosen is not None})
    return out


def write_plain_3mf(path: Path, pieces: list[tuple], filaments: list[dict], title: str = "") -> None:
    """3MF (core spec) whose pieces are objects made of one mesh per filament, colored with 3MF base materials.

    pieces: [(name, [(filament index 0..N-1, mesh), ...]), ...] in bed coordinates. Bambu Studio and OrcaSlicer read
    the colors of 3MF files from other programs and assign one filament per color.
    """
    def esc(t):
        return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))
    out = ['<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" '
           'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n',
           ' <metadata name="Application">print3d-modeler</metadata>\n',
           f' <metadata name="Title">{esc(title)}</metadata>\n <resources>\n  <basematerials id="1">\n']
    out += [f'   <base name="{esc(f["label"])} ({esc(f["material"])})" displaycolor="{f["color"]}FF"/>\n'
            for f in filaments]
    out.append('  </basematerials>\n')
    next_id, items = 1, []
    for name, volumes in pieces:
        comps = []
        for fi, mesh in volumes:
            next_id += 1
            out.append(f'  <object id="{next_id}" type="model" pid="1" pindex="{fi}" '
                       f'name="{esc(name)} - {esc(filaments[fi]["label"])}">\n   <mesh>\n    <vertices>\n')
            out += [f'     <vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}"/>\n' for x, y, z in mesh.vertices]
            out.append('    </vertices>\n    <triangles>\n')
            out += [f'     <triangle v1="{a}" v2="{b}" v3="{c}"/>\n' for a, b, c in mesh.faces]
            out.append('    </triangles>\n   </mesh>\n  </object>\n')
            comps.append(f'    <component objectid="{next_id}"/>\n')
        next_id += 1
        out.append(f'  <object id="{next_id}" type="model" name="{esc(name)}">\n   <components>\n'
                   + "".join(comps) + '   </components>\n  </object>\n')
        items.append(f'  <item objectid="{next_id}"/>\n')
    out.append(' </resources>\n <build>\n' + "".join(items) + ' </build>\n</model>\n')
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml",
                   '<?xml version="1.0" encoding="UTF-8"?>\n'
                   '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
                   ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n'
                   ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n'
                   '</Types>\n')
        z.writestr("_rels/.rels",
                   '<?xml version="1.0" encoding="UTF-8"?>\n'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
                   ' <Relationship Target="/3D/3dmodel.model" Id="rel0" '
                   'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>\n')
        z.writestr("3D/3dmodel.model", "".join(out))


def export_dir(d: str | Path, materials: dict | None = None) -> dict:
    """Write out/final/. materials: {filament id: material} decided at export time (overrides model.py)."""
    d = Path(d)
    pj = read_json(d / PARTS_JSON)
    printer = load_printer(d)
    fin = d / "out" / "final"
    fin.mkdir(parents=True, exist_ok=True)
    for old in fin.glob("*"):
        old.unlink()
    groups = pj["print_orientation"]["groups"]
    labels = {p["id"]: p["label"] for p in pj["parts"]}
    fls = _filaments(pj, printer, materials)
    multicolor = len(fls) >= 2
    slot = {f["id"]: f for f in fls}
    # one-color pieces weigh with the printer's material, or the model's one filament's material
    dens = density(fls[0]["material"] if len(fls) == 1 else printer.get("material", "PLA"))
    X, Y, Z = (float(v) for v in printer["build_volume_mm"])
    lay = _layout_status(pj, printer)
    project = project_for(printer)
    pset = ps.summarize(pj, printer, project["print_preset"] if project else None,
                        read_json(d / ANALYSIS_JSON) if (d / ANALYSIS_JSON).is_file() else {})
    # where the printer's build volume starts on the bed (not at x = 0 for the two-nozzle area of some printers)
    x0, y0 = project["area_origin_mm"] if project else (0.0, 0.0)
    plates: dict[int, list] = {}
    info = []
    for g, gi in groups.items():
        m = load_mesh(print_stl(d, g))
        plate = int(gi.get("plate", 1))
        # plate-centered coordinates (center of plate 1 at 0, 0) -> slicer bed coordinates of the piece's own plate
        # (front-left corner at 0, 0), using the bed the layout was made for (the printer's unless the layout is stale)
        T = np.eye(4)
        T[:3, 3] = [x0 + lay["bed"][0] / 2 - (plate - 1) * lay["pitch"], y0 + lay["bed"][1] / 2, 0.0]
        m.apply_transform(T)
        stl = fin / f"{pj['model']}_{g}.stl"
        m.export(stl)
        name = pj.get("objects", {}).get(g, g) if len(groups) > 1 else pj["title"]   # object name shown in the slicer
        volumes, fstls, group_g = [], [], 0.0
        if multicolor:
            gf = gi.get("filaments") or [next(p["filament"] for p in pj["parts"] if p["id"] == gi["parts"][0])]
            for fid in gf:
                if len(gf) == 1:
                    vm = m
                else:
                    vm = load_mesh(print_filament_stl(d, g, fid))
                    vm.apply_transform(T)
                    fstl = fin / f"{pj['model']}_{g}_{fid}.stl"
                    vm.export(fstl)
                    fstls.append(str(fstl.relative_to(d)))
                f = slot[fid]
                f.setdefault("pieces", []).append(g)
                fv = float(vm.volume) if vm.is_watertight else 0.0
                f["volume_mm3"] = f.get("volume_mm3", 0.0) + fv
                group_g += fv / 1000 * density(f["material"])
                volumes.append((f"{name} - {f['label']}", f["filament"], vm))
        plates.setdefault(plate, []).append((name, m, volumes, pset["bambu"]["groups"].get(g, {})))
        lo, hi = m.bounds
        on_bed = bool(lo[0] >= x0 - 0.01 and lo[1] >= y0 - 0.01 and hi[0] <= x0 + X + 0.01
                      and hi[1] <= y0 + Y + 0.01 and hi[2] <= Z + 0.01)
        vol = float(m.volume) if m.is_watertight else None
        info.append({
            "group": g, "parts": [f"{labels[p]} ({p})" for p in gi["parts"]],
            "stl": str(stl.relative_to(d)), "rotation_deg": gi["rotation_deg"], "bed_face": gi.get("bed_face", ""),
            "plate": plate, "bed_turn_deg": gi.get("bed_turn_deg", 0), "fits_bed": on_bed,
            "position_mm": [round(float(v), 1) for v in (lo + hi) / 2][:2],
            "size_mm": [round(float(v), 1) for v in m.extents], "min_z": round(float(m.bounds[0][2]), 3),
            "volume_cm3": round(vol / 1000, 2) if vol else None,
        })
        info[-1]["solid_weight_g"] = round(vol / 1000 * dens, 1) if vol else None
        if multicolor:   # each filament's volume weighs with its own material
            info[-1]["solid_weight_g"] = round(group_g, 1) if vol else None
            info[-1]["filaments"] = [v[1] for v in volumes]
            info[-1]["filament_stl"] = fstls
    n_plates = max(plates) if plates else 1
    tmfs, warnings = [], []
    for f in fls:
        if project:
            f["slicer_preset"] = filament_preset(printer, f["material"])
            if f["slicer_preset"] is None:
                f["slicer_preset"] = project["filament_preset"]
                warnings.append(f"{printer['name']} with a {printer['nozzle_mm']:g} mm nozzle has no Bambu Studio preset "
                                f"for {f['material']} (filament {f['filament']}, {f['label']}): written as "
                                f"{project['filament_preset']}. Choose the filament in Bambu Studio before slicing")
        if not f["material_decided"]:
            warnings.append(f"The material of filament {f['filament']} ({f['label']}) is not decided: written as "
                            f"{f['material']}. Choose it in the slicer's filament list, or export again with "
                            f"--material {f['id']}=<material>")
        if multicolor:
            v = f.pop("volume_mm3", 0.0)
            f["solid_weight_g"] = round(v / 1000 * density(f["material"]), 1) if v else None
    if project and fls:
        project["filaments"] = [{"preset": f["slicer_preset"], "color": f["color"]} for f in fls]
    if project:
        project["process_settings"] = pset["bambu"]["model"]
        project["bed_type"] = ps.BED_TYPES.get(pset["bed_type"]) if pset["bed_type"] else None
        tmf = fin / f"{pj['model']}.3mf"
        write_project(tmf, [plates.get(k, []) for k in range(1, n_plates + 1)], project, title=pj["title"])
        tmfs.append(str(tmf.relative_to(d)))
    elif multicolor:
        for plate in sorted(plates):
            suffix = f"_plate{plate}" if len(plates) > 1 else ""
            tmf = fin / f"{pj['model']}{suffix}.3mf"
            write_plain_3mf(tmf, [(name, [(fv - 1, vm) for _, fv, vm in vols]) for name, _, vols, _ in plates[plate]],
                            fls, title=pj["title"])
            tmfs.append(str(tmf.relative_to(d)))
    else:
        for plate in sorted(plates):
            scene = trimesh.Scene()
            used = set()
            for name, m, *_ in plates[plate]:
                # trimesh overwrites a node whose name is already taken, and labels need not be unique
                node, k = name, 2
                while node in used:
                    node, k = f"{name} ({k})", k + 1
                used.add(node)
                scene.add_geometry(m, node_name=node, geom_name=node)
            suffix = f"_plate{plate}" if len(plates) > 1 else ""
            tmf = fin / f"{pj['model']}{suffix}.3mf"
            scene.export(tmf)
            tmfs.append(str(tmf.relative_to(d)))
    if not lay["current"]:
        warnings.append(f"The layout was made for {lay['made_for'] or 'an older version'}, not for {printer['name']}: "
                        "run model.py again before printing")
    if n_plates > 1:
        where = ("plates 1-%d in one 3MF (Bambu Studio project)" % n_plates if project else "one 3MF per plate")
        warnings.append(f"The pieces do not fit on one plate of {printer['name']} ({X:g}×{Y:g} mm): "
                        f"{n_plates} print runs, {where}")
    warnings += pset.pop("warnings")
    checks = {t: check_file(d / t) for t in tmfs}
    fmt = {"ok": all(c["ok"] for c in checks.values()), "files": checks}
    if not fmt["ok"]:
        warnings.append("The 3MF format check failed (format_check): do not hand these files over; report the errors")
    warnings += [f"Piece {i['group']} does not fit the build volume of {printer['name']} ({X:g}×{Y:g}×{Z:g} mm)"
                 for i in info if not i["fits_bed"]]
    return {
        "model": pj["model"], "title": pj["title"],
        "files": {"3mf": tmfs, "stl": [i["stl"] for i in info],
                  **({"filament_stl": [s for i in info for s in i["filament_stl"]]} if multicolor else {})},
        "printer": {k: printer[k] for k in ("name", "build_volume_mm", "nozzle_mm", "layer_height_mm", "material")},
        "layout": {"plates": n_plates, "one_file": bool(project) or n_plates == 1,
                   "made_for_current_printer": lay["current"], "warnings": warnings},
        "slicer_project": ({**{k: project[k] for k in ("printer_preset", "print_preset", "filament_preset")},
                            **({"filament_presets": [f["preset"] for f in project["filaments"]]} if fls else {})}
                           if project else None),
        "groups": info, "analysis": _analysis_summary(d), "print_note": pj.get("print_note", ""),
        "print_settings": pset, "format_check": fmt,
        "note": WEIGHT_NOTE,
        **({"multicolor": multicolor, "filaments": fls} if fls else {}),
    }


def main(argv):
    args, materials = list(argv), {}
    while "--material" in args:
        i = args.index("--material")
        if i + 1 >= len(args) or "=" not in args[i + 1]:
            print(__doc__)
            return 2
        fid, mat = args[i + 1].split("=", 1)
        materials[fid.strip()] = mat.strip()
        del args[i:i + 2]
    if not args:
        print(__doc__)
        return 2
    print(json.dumps(export_dir(args[0], materials), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
