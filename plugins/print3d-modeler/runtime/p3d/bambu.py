"""Bambu Studio project 3MF: every plate in one file.

Plain 3MF (3MF core spec) has no notion of plates: a build is one list of items in one coordinate system. Bambu Studio
and OrcaSlicer add plates through their own files inside the package, and they only read them from a *project*:

  3D/3dmodel.model              root model. Metadata `Application` must start with "BambuStudio-": without it the file
                                counts as a foreign 3MF, Metadata/ is skipped, and every object is pulled to the middle
                                of plate 1 (so the pieces of plate 2 end up on plate 1)
  3D/Objects/object_<k>.model   one mesh per piece (3MF Production extension: the root model refers to it as a component)
  3D/_rels/3dmodel.model.rels   relationships to the object files
  Metadata/model_settings.config  per object: name and filament (`extruder`, 1-based), and one <part> per mesh of the
                                object with its own `extruder` in multi-color pieces; per plate: <plate> with
                                plater_id and the objects on it
  Metadata/project_settings.config  printer, process and filament presets (JSON). Without it Bambu Studio loads the
                                geometry only and drops the plates

Plates are not stored as offsets. Bambu Studio lays plates out on a grid in one world coordinate system and puts each
object on the plate whose area it is in: plate i (0-based) has its front-left corner at
(col * 1.2 * bed_width, -row * 1.2 * bed_depth), with cols = ceil(sqrt(plate count)), col = i % cols, row = i // cols
(PartPlateList::compute_shape_position, LOGICAL_PART_PLATE_GAP = 1/5). So each build item is written at its position
on its own plate plus that plate's origin. bed_width/depth are the printer profile's printable_area, which on two-nozzle
printers is wider than the area one nozzle reaches.

project_settings.config names system presets only (printer, process, filament) and lists no changed settings, so Bambu
Studio takes every value from its own presets (PresetCollection::load_external_preset) and changes nothing else.
Preset names follow resources/profiles/BBL in the BambuStudio repository (profile version 02.09, November 2026).

Print settings (p3d.print_settings): model-wide values go into project_settings.config with their keys listed in
different_settings_to_system[0], which is what makes Bambu Studio keep them over the system process preset; a piece's
own values go on its <object> in model_settings.config. curr_bed_type is always written for a known bed type: without
it Bambu Studio opens the project on the Cool Plate.

Multi-color: one object per printed piece, holding one part (volume) per filament with that filament's number as its
`extruder`; filament_settings_id and filament_colour list the project's filaments 1..N (inherits_group and
different_settings_to_system then have N + 2 entries: process, filaments, printer). The filaments are the project's,
not AMS slots: Bambu Studio maps them to the loaded filaments when the job is sent.
"""
from __future__ import annotations

import json
import math
import uuid
import zipfile
from datetime import date
from pathlib import Path

import numpy as np

from .bambu_filaments import FILAMENT_PRESETS

PLATE_GAP = 1 / 5                       # Bambu Studio LOGICAL_PART_PLATE_GAP
APPLICATION = "BambuStudio-02.00.00.00"  # oldest version with today's project layout; newer apps open it without a warning
FILAMENT_COLOUR = "#FFFFFF"

# printer.py preset key -> Bambu Studio printer model, bed (printable_area, X × Y mm), x of the area both nozzles reach
# (two-nozzle printers, "nozzle_mode": "dual") and, per nozzle size, the default process and filament presets of that
# printer profile.
PRINTERS = {
    "bambu-a1-mini": {"model": "Bambu Lab A1 mini", "bed_mm": (180, 180), "nozzles": {
        0.2: ("0.10mm Standard @BBL A1M 0.2 nozzle", "Bambu PLA Basic @BBL A1M 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL A1M", "Bambu PLA Basic @BBL A1M"),
        0.6: ("0.30mm Standard @BBL A1M 0.6 nozzle", "Bambu PLA Basic @BBL A1M"),
        0.8: ("0.40mm Standard @BBL A1M 0.8 nozzle", "Bambu PLA Basic @BBL A1M")}},
    "bambu-a1": {"model": "Bambu Lab A1", "bed_mm": (256, 256), "nozzles": {
        0.2: ("0.10mm Standard @BBL A1 0.2 nozzle", "Bambu PLA Basic @BBL A1 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL A1", "Bambu PLA Basic @BBL A1"),
        0.6: ("0.30mm Strength @BBL A1 0.6 nozzle", "Bambu PLA Basic @BBL A1"),
        0.8: ("0.40mm Standard @BBL A1 0.8 nozzle", "Bambu PLA Basic @BBL A1")}},
    "bambu-p1p": {"model": "Bambu Lab P1P", "bed_mm": (256, 256), "nozzles": {
        0.2: ("0.10mm Standard @BBL P1P 0.2 nozzle", "Bambu PLA Basic @BBL P1P 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL P1P", "Bambu PLA Basic @BBL P1P"),
        0.6: ("0.30mm Standard @BBL P1P 0.6 nozzle", "Bambu PLA Basic @BBL P1P 0.6 nozzle"),
        0.8: ("0.40mm Standard @BBL P1P 0.8 nozzle", "Bambu PLA Basic @BBL P1P")}},
    "bambu-p1s": {"model": "Bambu Lab P1S", "bed_mm": (256, 256), "nozzles": {
        0.2: ("0.10mm Standard @BBL X1C 0.2 nozzle", "Bambu PLA Basic @BBL X1C 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL X1C", "Bambu PLA Basic @BBL P1S 0.4 nozzle"),
        0.6: ("0.30mm Standard @BBL X1C 0.6 nozzle", "Bambu PLA Basic @BBL P1S 0.6 nozzle"),
        0.8: ("0.40mm Standard @BBL X1C 0.8 nozzle", "Bambu PLA Basic @BBL X1C 0.8 nozzle")}},
    "bambu-p2s": {"model": "Bambu Lab P2S", "bed_mm": (256, 256), "nozzles": {
        0.2: ("0.10mm Standard @BBL P2S 0.2 nozzle", "Bambu PLA Basic @BBL P2S 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL P2S", "Bambu PLA Basic @BBL P2S"),
        0.6: ("0.30mm Standard @BBL P2S 0.6 nozzle", "Bambu PLA Basic @BBL P2S 0.6 nozzle"),
        0.8: ("0.40mm Standard @BBL P2S 0.8 nozzle", "Bambu PLA Basic @BBL P2S 0.8 nozzle")}},
    "bambu-x1c": {"model": "Bambu Lab X1 Carbon", "bed_mm": (256, 256), "nozzles": {
        0.2: ("0.10mm Standard @BBL X1C 0.2 nozzle", "Bambu PLA Basic @BBL X1C 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL X1C", "Bambu PLA Basic @BBL X1C"),
        0.6: ("0.30mm Standard @BBL X1C 0.6 nozzle", "Bambu PLA Basic @BBL X1C 0.6 nozzle"),
        0.8: ("0.40mm Standard @BBL X1C 0.8 nozzle", "Bambu PLA Basic @BBL X1C 0.8 nozzle")}},
    "bambu-x1e": {"model": "Bambu Lab X1E", "bed_mm": (256, 256), "nozzles": {
        0.2: ("0.10mm Standard @BBL X1C 0.2 nozzle", "Bambu PLA Basic @BBL X1C 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL X1C", "Bambu PLA Basic @BBL X1C"),
        0.6: ("0.30mm Standard @BBL X1C 0.6 nozzle", "Bambu PLA Basic @BBL X1C"),
        0.8: ("0.40mm Standard @BBL X1C 0.8 nozzle", "Bambu PLA Basic @BBL X1C 0.8 nozzle")}},
    "bambu-x2d": {"model": "Bambu Lab X2D", "bed_mm": (256, 256), "dual_x_mm": 20.5, "nozzles": {
        0.2: ("0.10mm Standard @BBL X2D 0.2 nozzle", "Bambu PLA Basic @BBL X2D 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL X2D", "Bambu PLA Basic @BBL X2D 0.4 nozzle"),
        0.6: ("0.30mm Standard @BBL X2D 0.6 nozzle", "Bambu PLA Basic @BBL X2D 0.6 nozzle"),
        0.8: ("0.40mm Standard @BBL X2D 0.8 nozzle", "Bambu PLA Basic @BBL X2D 0.8 nozzle")}},
    "bambu-h2s": {"model": "Bambu Lab H2S", "bed_mm": (340, 320), "nozzles": {
        0.2: ("0.10mm Standard @BBL H2S 0.2 nozzle", "Bambu PLA Basic @BBL H2S 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL H2S", "Bambu PLA Basic @BBL H2S"),
        0.6: ("0.30mm Standard @BBL H2S 0.6 nozzle", "Bambu PLA Basic @BBL H2S 0.6 nozzle"),
        0.8: ("0.40mm Standard @BBL H2S 0.8 nozzle", "Bambu PLA Basic @BBL H2S 0.8 nozzle")}},
    "bambu-h2d": {"model": "Bambu Lab H2D", "bed_mm": (350, 320), "dual_x_mm": 25, "nozzles": {
        0.2: ("0.10mm Standard @BBL H2D 0.2 nozzle", "Bambu PLA Basic @BBL H2D 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL H2D", "Bambu PLA Basic @BBL H2D"),
        0.6: ("0.30mm Standard @BBL H2D 0.6 nozzle", "Bambu PLA Basic @BBL H2D 0.6 nozzle"),
        0.8: ("0.40mm Standard @BBL H2D 0.8 nozzle", "Bambu PLA Basic @BBL H2D 0.8 nozzle")}},
    "bambu-h2d-pro": {"model": "Bambu Lab H2D Pro", "bed_mm": (350, 320), "dual_x_mm": 25, "nozzles": {
        0.2: ("0.10mm Standard @BBL H2DP 0.2 nozzle", "Bambu PLA Basic @BBL H2DP 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL H2DP", "Bambu PLA Basic @BBL H2DP"),
        0.6: ("0.30mm Standard @BBL H2DP 0.6 nozzle", "Bambu PLA Basic @BBL H2DP 0.6 nozzle"),
        0.8: ("0.40mm Standard @BBL H2DP 0.8 nozzle", "Bambu PLA Basic @BBL H2DP 0.8 nozzle")}},
    "bambu-h2c": {"model": "Bambu Lab H2C", "bed_mm": (330, 320), "dual_x_mm": 25, "nozzles": {
        0.2: ("0.10mm Standard @BBL H2C 0.2 nozzle", "Bambu PLA Basic @BBL H2C 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL H2C", "Bambu PLA Basic @BBL H2C"),
        0.6: ("0.30mm Standard @BBL H2C 0.6 nozzle", "Bambu PLA Basic @BBL H2C 0.6 nozzle"),
        0.8: ("0.40mm Standard @BBL H2C 0.8 nozzle", "Bambu PLA Basic @BBL H2C 0.8 nozzle")}},
    "bambu-h3c": {"model": "Bambu Lab H3C", "bed_mm": (330, 320), "nozzles": {
        0.2: ("0.10mm Standard @BBL H3C 0.2 nozzle", "Bambu PLA Basic @BBL H3C 0.2 nozzle"),
        0.4: ("0.20mm Standard @BBL H3C", "Bambu PLA Basic @BBL H3C"),
        0.6: ("0.30mm Standard @BBL H3C 0.6 nozzle", "Bambu PLA Basic @BBL H3C 0.6 nozzle"),
        0.8: ("0.40mm Standard @BBL H3C 0.8 nozzle", "Bambu PLA Basic @BBL H3C 0.8 nozzle")}},
}


# filaments the AMS of each printer can hold at once: one AMS lite (4) on the A1 series, up to four AMS units (16) on
# the others
MAX_FILAMENTS = {"bambu-a1-mini": 4, "bambu-a1": 4}
MAX_FILAMENTS_DEFAULT = 16


def max_filaments(printer: dict) -> int | None:
    """How many filaments a Bambu Lab printer's AMS can feed in one print, or None for other printers."""
    key = printer.get("preset") or ""
    return MAX_FILAMENTS.get(key, MAX_FILAMENTS_DEFAULT) if key in PRINTERS else None


def filament_preset(printer: dict, material: str | None) -> str | None:
    """System filament preset for a material on a Bambu Lab printer and nozzle (None: no preset for it there).

    PLA, and no material, give the printer profile's default filament (Bambu PLA Basic)."""
    spec = PRINTERS.get(printer.get("preset") or "")
    if spec is None:
        return None
    nozzle = round(float(printer.get("nozzle_mm", 0.4)), 1)
    if nozzle not in spec["nozzles"]:
        return None
    if material in (None, "PLA"):
        return spec["nozzles"][nozzle][1]
    return FILAMENT_PRESETS.get(printer["preset"], {}).get(nozzle, {}).get(material)


def project_for(printer: dict) -> dict | None:
    """Bambu Studio project settings for a resolved printer, or None when it is not a known Bambu Lab printer/nozzle.

    Returns {"printer_model", "printer_preset", "print_preset", "filament_preset", "bed_mm", "area_origin_mm"};
    area_origin_mm is where the printer's build_volume_mm starts on the Bambu bed (the area both nozzles reach is
    not at x = 0). Add "filaments": [{"preset", "color"}, ...] for more than one filament or another color.
    """
    spec = PRINTERS.get(printer.get("preset") or "")
    if spec is None:
        return None
    nozzle = round(float(printer.get("nozzle_mm", 0.4)), 1)
    if nozzle not in spec["nozzles"]:
        return None
    process, filament = spec["nozzles"][nozzle]
    dual = printer.get("nozzle_mode") == "dual"
    return {"printer_model": spec["model"], "printer_preset": f"{spec['model']} {nozzle:g} nozzle",
            "print_preset": process, "filament_preset": filament, "bed_mm": [float(v) for v in spec["bed_mm"]],
            "area_origin_mm": [float(spec.get("dual_x_mm", 0)) if dual else 0.0, 0.0]}


def plate_origin(index: int, count: int, bed) -> tuple[float, float]:
    """Front-left corner of plate `index` (0-based) of `count` in Bambu Studio's world coordinates."""
    v = math.sqrt(count)
    cols = int(round(v)) + (1 if v > round(v) else 0)
    row, col = divmod(index, cols)
    return col * float(bed[0]) * (1 + PLATE_GAP), -row * float(bed[1]) * (1 + PLATE_GAP)


# --------------------------------------------------------------------- writing
CORE_NS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
PROD_NS = "http://schemas.microsoft.com/3dmanufacturing/production/2015/06"
BAMBU_NS = "http://schemas.bambulab.com/package/2021"
MODEL_REL = "http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"
IDENTITY = "1 0 0 0 1 0 0 0 1 0 0 0"

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="png" ContentType="image/png"/>
 <Default Extension="config" ContentType="text/plain"/>
</Types>
"""


def _esc(s: str) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;").replace("'", "&apos;"))


def _uuid(*parts) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "print3d-modeler/" + "/".join(map(str, parts))))


def _model_head() -> str:
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="{CORE_NS}" '
            f'xmlns:BambuStudio="{BAMBU_NS}" xmlns:p="{PROD_NS}" requiredextensions="p">\n')


def _mesh_xml(mesh_id: int, uid: str, verts: np.ndarray, faces: np.ndarray) -> list[str]:
    out = [f'  <object id="{mesh_id}" p:UUID="{uid}" type="model">\n   <mesh>\n    <vertices>\n']
    out += [f'     <vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}"/>\n' for x, y, z in verts]
    out.append('    </vertices>\n    <triangles>\n')
    out += [f'     <triangle v1="{a}" v2="{b}" v3="{c}"/>\n' for a, b, c in faces]
    out.append('    </triangles>\n   </mesh>\n  </object>\n')
    return out


def _object_file(meshes: list[tuple[int, str, np.ndarray, np.ndarray]]) -> str:
    """One object file holding the meshes (mesh_id, uuid, vertices, faces) of one printed piece."""
    out = [_model_head(), ' <metadata name="BambuStudio:3mfVersion">1</metadata>\n <resources>\n']
    for mesh_id, uid, verts, faces in meshes:
        out += _mesh_xml(mesh_id, uid, verts, faces)
    out.append(' </resources>\n <build/>\n</model>\n')
    return "".join(out)


def write_project(path: str | Path, plates: list[list[tuple]], project: dict, title: str = "") -> list[dict]:
    """Write one Bambu Studio project 3MF holding every plate.

    plates[i] is the list of pieces on plate i + 1, each mesh already in that plate's bed coordinates (front-left
    corner of the bed at 0, 0, bottom at Z = 0). A piece is (name, trimesh mesh), printed with filament 1, or
    (name, mesh, volumes) with volumes = [(part name, filament number 1..N, mesh), ...] that make up the piece
    (multi-color: one volume per filament), or (name, mesh, volumes, settings) with the piece's own Bambu Studio
    settings {key: string value}. Names need not be unique. project["filaments"], when present, lists the
    project's filaments [{"preset", "color"}, ...]; project["process_settings"] holds model-wide Bambu Studio process
    settings {key: string value} and project["bed_type"] the curr_bed_type name. Returns where each piece went, in
    input order:
    [{"name", "plate", "plate_origin_mm", "position_mm"}].
    """
    path = Path(path)
    bed = project["bed_mm"]
    root_objects, build_items, rels, config_objects, config_plates, placed = [], [], [], [], [], []
    files = {}
    k = 0
    next_id = 0
    for p, pieces in enumerate(plates):
        ox, oy = plate_origin(p, len(plates), bed)
        instances = []
        for piece in pieces:
            name, mesh = piece[0], piece[1]
            volumes = piece[2] if len(piece) > 2 and piece[2] else [(name, 1, mesh)]
            settings = piece[3] if len(piece) > 3 and piece[3] else {}
            k += 1
            v = np.asarray(mesh.vertices, dtype=float)
            lo, hi = v.min(0), v.max(0)
            c = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, 0.0])
            obj_path = f"/3D/Objects/object_{k}.model"
            meshes, components, parts = [], [], []
            for j, (vname, extruder, vmesh) in enumerate(volumes):
                next_id += 1
                mesh_id = next_id
                tag = (k, name) if len(volumes) == 1 else (k, name, j)   # one-volume pieces keep their old UUIDs
                meshes.append((mesh_id, _uuid("mesh", *tag), np.asarray(vmesh.vertices, dtype=float) - c,
                               np.asarray(vmesh.faces, dtype=int)))
                components.append(f'    <component p:path="{obj_path}" objectid="{mesh_id}" '
                                  f'p:UUID="{_uuid("component", *tag)}" transform="{IDENTITY}"/>\n')
                # a part's own extruder only counts when the object has several parts (Bambu Studio drops it otherwise)
                ext = f'      <metadata key="extruder" value="{int(extruder)}"/>\n' if len(volumes) > 1 else ""
                parts.append(f'    <part id="{mesh_id}" subtype="normal_part">\n'
                             f'      <metadata key="name" value="{_esc(vname)}"/>\n'
                             f'      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n'
                             + ext + '    </part>\n')
            next_id += 1
            obj_id = next_id
            files[obj_path[1:]] = _object_file(meshes)
            rels.append(f' <Relationship Target="{obj_path}" Id="rel-{k}" Type="{MODEL_REL}"/>\n')
            root_objects.append(
                f'  <object id="{obj_id}" p:UUID="{_uuid("object", k, name)}" type="model">\n   <components>\n'
                + "".join(components) + '   </components>\n  </object>\n')
            tx, ty = c[0] + ox, c[1] + oy
            build_items.append(f'  <item objectid="{obj_id}" p:UUID="{_uuid("item", k, name)}" '
                               f'transform="1 0 0 0 1 0 0 0 1 {tx:.6f} {ty:.6f} 0" printable="1"/>\n')
            config_objects.append(
                f'  <object id="{obj_id}">\n'
                f'    <metadata key="name" value="{_esc(name)}"/>\n'
                f'    <metadata key="extruder" value="{int(volumes[0][1])}"/>\n'
                + "".join(f'    <metadata key="{_esc(sk)}" value="{_esc(sv)}"/>\n' for sk, sv in sorted(settings.items()))
                + "".join(parts) + '  </object>\n')
            instances.append(f'    <model_instance>\n      <metadata key="object_id" value="{obj_id}"/>\n'
                             f'      <metadata key="instance_id" value="0"/>\n'
                             f'      <metadata key="identify_id" value="{100 + k}"/>\n    </model_instance>\n')
            placed.append({"name": name, "plate": p + 1, "plate_origin_mm": [round(ox, 3), round(oy, 3)],
                           "position_mm": [round(float(c[0]), 2), round(float(c[1]), 2)]})
        config_plates.append(f'  <plate>\n    <metadata key="plater_id" value="{p + 1}"/>\n'
                             f'    <metadata key="plater_name" value=""/>\n'
                             f'    <metadata key="locked" value="false"/>\n' + "".join(instances) + '  </plate>\n')

    today = date.today().isoformat()
    meta = {"Application": APPLICATION, "BambuStudio:3mfVersion": "1", "Title": title, "CreationDate": today,
            "ModificationDate": today}
    files["3D/3dmodel.model"] = (
        _model_head() + "".join(f' <metadata name="{_esc(k_)}">{_esc(v_)}</metadata>\n' for k_, v_ in meta.items())
        + " <resources>\n" + "".join(root_objects) + " </resources>\n"
        + f' <build p:UUID="{_uuid("build")}">\n' + "".join(build_items) + " </build>\n</model>\n")
    files["3D/_rels/3dmodel.model.rels"] = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
        + "".join(rels) + "</Relationships>\n")
    files["Metadata/model_settings.config"] = (
        '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n' + "".join(config_objects) + "".join(config_plates)
        + "</config>\n")
    filaments = project.get("filaments") or [{"preset": project["filament_preset"], "color": FILAMENT_COLOUR}]
    process = dict(sorted((project.get("process_settings") or {}).items()))
    ps = {
        "name": "project_settings", "from": "project",
        "printer_model": project["printer_model"],
        "printer_settings_id": project["printer_preset"],
        "print_settings_id": project["print_preset"],
        "filament_settings_id": [f["preset"] for f in filaments],
        "filament_colour": [f["color"] for f in filaments],
        # one entry each for the process, every filament and the printer; a process value counts only when its key
        # is listed in the first entry, everything else comes from the system presets
        "inherits_group": [""] * (len(filaments) + 2),
        "different_settings_to_system": [";".join(process)] + [""] * (len(filaments) + 1),
        **process,
    }
    if project.get("bed_type"):
        ps["curr_bed_type"] = project["bed_type"]
    files["Metadata/project_settings.config"] = json.dumps(ps, indent=4) + "\n"

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("_rels/.rels",
                   '<?xml version="1.0" encoding="UTF-8"?>\n'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
                   f' <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="{MODEL_REL}"/>\n</Relationships>\n')
        for name, text in files.items():
            z.writestr(name, text)
    return placed
