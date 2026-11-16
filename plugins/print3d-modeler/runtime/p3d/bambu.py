"""Bambu Studio project 3MF: every plate in one file.

Plain 3MF (3MF core spec) has no notion of plates: a build is one list of items in one coordinate system. Bambu Studio
and OrcaSlicer add plates through their own files inside the package, and they only read them from a *project*:

  3D/3dmodel.model              root model. Metadata `Application` must start with "BambuStudio-": without it the file
                                counts as a foreign 3MF, Metadata/ is skipped, and every object is pulled to the middle
                                of plate 1 (so the pieces of plate 2 end up on plate 1)
  3D/Objects/object_<k>.model   one mesh per piece (3MF Production extension: the root model refers to it as a component)
  3D/_rels/3dmodel.model.rels   relationships to the object files
  Metadata/model_settings.config  per object: name and filament; per plate: <plate> with plater_id and the objects on it
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
"""
from __future__ import annotations

import json
import math
import uuid
import zipfile
from datetime import date
from pathlib import Path

import numpy as np

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


def project_for(printer: dict) -> dict | None:
    """Bambu Studio project settings for a resolved printer, or None when it is not a known Bambu Lab printer/nozzle.

    Returns {"printer_model", "printer_preset", "print_preset", "filament_preset", "bed_mm", "area_origin_mm"};
    area_origin_mm is where the printer's build_volume_mm starts on the Bambu bed (the area both nozzles reach is
    not at x = 0).
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


def _object_file(mesh_id: int, name: str, verts: np.ndarray, faces: np.ndarray) -> str:
    out = [_model_head(), ' <metadata name="BambuStudio:3mfVersion">1</metadata>\n <resources>\n',
           f'  <object id="{mesh_id}" p:UUID="{_uuid("mesh", name)}" type="model">\n   <mesh>\n    <vertices>\n']
    out += [f'     <vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}"/>\n' for x, y, z in verts]
    out.append('    </vertices>\n    <triangles>\n')
    out += [f'     <triangle v1="{a}" v2="{b}" v3="{c}"/>\n' for a, b, c in faces]
    out.append('    </triangles>\n   </mesh>\n  </object>\n </resources>\n <build/>\n</model>\n')
    return "".join(out)


def write_project(path: str | Path, plates: list[list[tuple[str, object]]], project: dict, title: str = "") -> dict:
    """Write one Bambu Studio project 3MF holding every plate.

    plates[i] is the list of (name, trimesh mesh) on plate i + 1, each mesh already in that plate's bed coordinates
    (front-left corner of the bed at 0, 0, bottom at Z = 0). Returns where each piece went:
    {name: {"plate", "plate_origin_mm", "position_mm"}}.
    """
    path = Path(path)
    bed = project["bed_mm"]
    root_objects, build_items, rels, config_objects, config_plates, placed = [], [], [], [], [], {}
    files = {}
    k = 0
    for p, pieces in enumerate(plates):
        ox, oy = plate_origin(p, len(plates), bed)
        instances = []
        for name, mesh in pieces:
            k += 1
            mesh_id, obj_id = 2 * k - 1, 2 * k
            v = np.asarray(mesh.vertices, dtype=float)
            lo, hi = v.min(0), v.max(0)
            c = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, 0.0])
            obj_path = f"/3D/Objects/object_{k}.model"
            files[obj_path[1:]] = _object_file(mesh_id, name, v - c, np.asarray(mesh.faces, dtype=int))
            rels.append(f' <Relationship Target="{obj_path}" Id="rel-{k}" Type="{MODEL_REL}"/>\n')
            root_objects.append(
                f'  <object id="{obj_id}" p:UUID="{_uuid("object", k, name)}" type="model">\n   <components>\n'
                f'    <component p:path="{obj_path}" objectid="{mesh_id}" p:UUID="{_uuid("component", k, name)}" '
                f'transform="{IDENTITY}"/>\n   </components>\n  </object>\n')
            tx, ty = c[0] + ox, c[1] + oy
            build_items.append(f'  <item objectid="{obj_id}" p:UUID="{_uuid("item", k, name)}" '
                               f'transform="1 0 0 0 1 0 0 0 1 {tx:.6f} {ty:.6f} 0" printable="1"/>\n')
            config_objects.append(
                f'  <object id="{obj_id}">\n'
                f'    <metadata key="name" value="{_esc(name)}"/>\n'
                f'    <metadata key="extruder" value="1"/>\n'
                f'    <part id="{mesh_id}" subtype="normal_part">\n'
                f'      <metadata key="name" value="{_esc(name)}"/>\n'
                f'      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n'
                f'    </part>\n  </object>\n')
            instances.append(f'    <model_instance>\n      <metadata key="object_id" value="{obj_id}"/>\n'
                             f'      <metadata key="instance_id" value="0"/>\n'
                             f'      <metadata key="identify_id" value="{100 + k}"/>\n    </model_instance>\n')
            placed[name] = {"plate": p + 1, "plate_origin_mm": [round(ox, 3), round(oy, 3)],
                            "position_mm": [round(float(c[0]), 2), round(float(c[1]), 2)]}
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
    files["Metadata/project_settings.config"] = json.dumps({
        "name": "project_settings", "from": "project",
        "printer_model": project["printer_model"],
        "printer_settings_id": project["printer_preset"],
        "print_settings_id": project["print_preset"],
        "filament_settings_id": [project["filament_preset"]],
        "filament_colour": [FILAMENT_COLOUR],
        # one entry each for the process, the filament and the printer: nothing differs from the system presets
        "inherits_group": ["", "", ""],
        "different_settings_to_system": ["", "", ""],
    }, indent=4) + "\n"

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("_rels/.rels",
                   '<?xml version="1.0" encoding="UTF-8"?>\n'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
                   f' <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="{MODEL_REL}"/>\n</Relationships>\n')
        for name, text in files.items():
            z.writestr(name, text)
    return placed
