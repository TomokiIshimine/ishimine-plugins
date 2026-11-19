"""Check a 3MF written by p3d.export: package structure, meshes, and the Bambu Studio project files.

    python -m p3d.check3mf <file.3mf> [...]       prints JSON {file: {"ok", "errors", "kind"}}; exit 1 if any fails

p3d.export runs it on every 3MF it writes (`format_check` in its JSON). It is written separately from the writers
(p3d.bambu, p3d.export) and checks the rules Bambu Studio applies when it opens a project (BambuStudio, November 2026:
src/libslic3r/Format/bbs_3mf.cpp, PresetBundle.cpp, Preset.cpp, PrintConfig.cpp), so a mistake in a writer shows up
here instead of as a file that opens wrong:

  package    [Content_Types].xml, _rels/.rels pointing at the root model, relationship targets that exist
  meshes     every build item and component points at an object that exists; triangles index existing vertices;
             coordinates are finite; no object is empty
  project    (Application "BambuStudio-..." only) project_settings.config is JSON with the preset names, filament
             lists of one length N, inherits_group / different_settings_to_system of length N + 2, only string values,
             every listed key present, every process key we write listed (Bambu Studio silently resets unlisted
             ones), values Bambu Studio accepts for the keys it knows, a valid curr_bed_type;
             model_settings.config objects matching the build items, filament numbers 1..N, known per-object keys
             with valid values, plates numbered 1..n that hold existing objects
"""
from __future__ import annotations

import json
import math
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

CORE = "{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}"
PROD = "{http://schemas.microsoft.com/3dmanufacturing/production/2015/06}"
RELS = "{http://schemas.openxmlformats.org/package/2006/relationships}"

# Values Bambu Studio accepts (PrintConfig.cpp enum maps and option types), for the keys p3d writes.
INFILL = ("concentric", "zig-zag", "grid", "line", "cubic", "triangles", "tri-hexagon", "gyroid", "honeycomb",
          "adaptivecubic", "monotonic", "monotonicline", "alignedrectilinear", "3dhoneycomb", "hilbertcurve",
          "archimedeanchords", "octagramspiral", "supportcubic", "lightning", "crosshatch", "zigzag", "crosszag",
          "lockedzag", "2dlattice")
VALUE_RULES = {
    "layer_height": ("float", 0.01, 2.0),
    "wall_loops": ("int", 0, 1000),
    "top_shell_layers": ("int", 0, 1000),
    "bottom_shell_layers": ("int", 0, 1000),
    "sparse_infill_density": ("percent", 0, 100),
    "sparse_infill_pattern": ("enum", INFILL),
    "enable_support": ("bool",),
    "support_type": ("enum", ("normal(auto)", "tree(auto)", "normal(manual)", "tree(manual)")),
    "support_on_build_plate_only": ("bool",),
    "brim_type": ("enum", ("auto_brim", "brim_ears", "outer_only", "inner_only", "outer_and_inner", "no_brim")),
    "brim_width": ("float", 0, 1000),
}
PER_OBJECT = set(VALUE_RULES) - {"layer_height"}       # what p3d writes on a piece (layer_height stays model-wide)
OBJECT_KEYS = {"name", "extruder", "module"}            # object metadata that is not a print setting
BED_TYPES = ("Default Plate", "Cool Plate", "Engineering Plate", "High Temp Plate", "Textured PEI Plate",
             "Supertack Plate")
PROJECT_REQUIRED = ("printer_settings_id", "print_settings_id", "filament_settings_id", "filament_colour",
                    "inherits_group", "different_settings_to_system")


def _value_error(key: str, value: str) -> str | None:
    rule = VALUE_RULES.get(key)
    if rule is None:
        return None
    kind = rule[0]
    try:
        if kind == "bool":
            ok = value in ("0", "1")
        elif kind == "enum":
            ok = value in rule[1]
        elif kind == "int":
            ok = re.fullmatch(r"-?\d+", value) is not None and rule[1] <= int(value) <= rule[2]
        elif kind == "percent":
            ok = value.endswith("%") and rule[1] <= float(value[:-1]) <= rule[2]
        else:
            ok = rule[1] <= float(value) <= rule[2] and math.isfinite(float(value))
    except ValueError:
        ok = False
    return None if ok else f"{key} = {value!r} is not a value Bambu Studio accepts ({kind})"


def _xml(z: zipfile.ZipFile, name: str, errors: list) -> ET.Element | None:
    try:
        return ET.fromstring(z.read(name))
    except KeyError:
        errors.append(f"missing {name}")
    except ET.ParseError as e:
        errors.append(f"{name} is not valid XML: {e}")
    return None


def _check_mesh(obj: ET.Element, where: str, errors: list) -> None:
    mesh = obj.find(f"{CORE}mesh")
    verts = mesh.find(f"{CORE}vertices").findall(f"{CORE}vertex")
    tris = mesh.find(f"{CORE}triangles").findall(f"{CORE}triangle")
    if not verts or not tris:
        errors.append(f"{where}: object {obj.get('id')} has an empty mesh")
        return
    for v in verts:
        if not all(math.isfinite(float(v.get(a))) for a in "xyz"):
            errors.append(f"{where}: object {obj.get('id')} has a vertex that is not a finite number")
            break
    n = len(verts)
    for t in tris:
        ids = [int(t.get(a)) for a in ("v1", "v2", "v3")]
        if not all(0 <= i < n for i in ids):
            errors.append(f"{where}: object {obj.get('id')} has a triangle pointing past its {n} vertices")
            break


def _objects(root: ET.Element) -> dict[str, ET.Element]:
    res = root.find(f"{CORE}resources")
    return {o.get("id"): o for o in (res.findall(f"{CORE}object") if res is not None else [])}


def _check_package(z: zipfile.ZipFile, errors: list) -> tuple[ET.Element | None, str]:
    names = set(z.namelist())
    if "[Content_Types].xml" not in names:
        errors.append("missing [Content_Types].xml")
    rels = _xml(z, "_rels/.rels", errors)
    root_path = "3D/3dmodel.model"
    if rels is not None:
        targets = [r.get("Target", "").lstrip("/") for r in rels.findall(f"{RELS}Relationship")]
        if not targets:
            errors.append("_rels/.rels names no model")
        else:
            root_path = targets[0]
    root = _xml(z, root_path, errors)
    if root is None:
        return None, root_path
    if root.get("unit", "millimeter") != "millimeter":
        errors.append(f"the model unit is {root.get('unit')!r}, not millimeter")
    model_rels = f"{root_path.rsplit('/', 1)[0]}/_rels/{root_path.rsplit('/', 1)[1]}.rels"
    if model_rels in names:
        mr = _xml(z, model_rels, errors)
        for r in (mr.findall(f"{RELS}Relationship") if mr is not None else []):
            if r.get("Target", "").lstrip("/") not in names:
                errors.append(f"{model_rels} points at {r.get('Target')}, which is not in the file")

    objs = _objects(root)
    sub_models: dict[str, dict[str, ET.Element]] = {}
    for oid, obj in objs.items():
        if obj.find(f"{CORE}mesh") is not None:
            _check_mesh(obj, root_path, errors)
        comps = obj.find(f"{CORE}components")
        for c in (comps.findall(f"{CORE}component") if comps is not None else []):
            path = (c.get(f"{PROD}path") or "").lstrip("/")
            if path:
                if path not in sub_models:
                    sub = _xml(z, path, errors)
                    sub_models[path] = _objects(sub) if sub is not None else {}
                    for so in sub_models[path].values():
                        if so.find(f"{CORE}mesh") is not None:
                            _check_mesh(so, path, errors)
                target = sub_models[path].get(c.get("objectid"))
            else:
                target = objs.get(c.get("objectid"))
            if target is None:
                errors.append(f"object {oid} has a component pointing at object {c.get('objectid')} "
                              f"{'in ' + path if path else ''}, which does not exist")
    build = root.find(f"{CORE}build")
    items = build.findall(f"{CORE}item") if build is not None else []
    if not items:
        errors.append("the build has no items: nothing would be placed on the bed")
    for it in items:
        if it.get("objectid") not in objs:
            errors.append(f"build item points at object {it.get('objectid')}, which does not exist")
    return root, root_path


def _check_project(z: zipfile.ZipFile, root: ET.Element, errors: list) -> None:
    try:
        ps = json.loads(z.read("Metadata/project_settings.config"))
    except KeyError:
        errors.append("missing Metadata/project_settings.config: Bambu Studio would load the geometry only and "
                      "drop the plates")
        return
    except ValueError as e:
        errors.append(f"Metadata/project_settings.config is not JSON: {e}")
        return
    for k in PROJECT_REQUIRED:
        if k not in ps:
            errors.append(f"project_settings.config has no {k}")
    for k, v in ps.items():
        if not (isinstance(v, str) or (isinstance(v, list) and all(isinstance(x, str) for x in v))):
            errors.append(f"project_settings.config: {k} must be a string or a list of strings "
                          "(Bambu Studio drops the settings otherwise)")
    colours = ps.get("filament_colour") or []
    n = len(colours)
    if n == 0:
        errors.append("project_settings.config: filament_colour is empty (Bambu Studio: invalid configuration file)")
    if len(ps.get("filament_settings_id") or []) != n:
        errors.append(f"project_settings.config: {len(ps.get('filament_settings_id') or [])} filament presets "
                      f"but {n} filament colors")
    for k in ("inherits_group", "different_settings_to_system"):
        if k in ps and len(ps[k]) != n + 2:
            errors.append(f"project_settings.config: {k} has {len(ps[k])} entries, not {n + 2} "
                          "(process, each filament, printer)")
    diff = ps.get("different_settings_to_system") or [""]
    listed = [k for k in (diff[0] or "").split(";") if k]
    for k in listed:
        if k not in ps:
            errors.append(f"project_settings.config lists {k} as changed but has no value for it")
    for k in VALUE_RULES:
        if k in ps and k not in listed:
            errors.append(f"project_settings.config sets {k} without listing it in different_settings_to_system: "
                          "Bambu Studio resets it to the preset's value")
        if k in ps:
            err = _value_error(k, ps[k]) if isinstance(ps[k], str) else f"{k} must be one string"
            if err:
                errors.append(f"project_settings.config: {err}")
    for i, entry in enumerate(diff[1:], 1):
        for k in (entry or "").split(";"):
            if k and k not in ps:
                errors.append(f"project_settings.config lists {k} (entry {i}) as changed but has no value for it")
    if "curr_bed_type" in ps and ps["curr_bed_type"] not in BED_TYPES:
        errors.append(f"project_settings.config: curr_bed_type {ps['curr_bed_type']!r} is not a bed type")

    cfg = _xml(z, "Metadata/model_settings.config", errors)
    if cfg is None:
        return
    build_ids = [it.get("objectid") for it in root.find(f"{CORE}build").findall(f"{CORE}item")]
    seen = set()
    for obj in cfg.findall("object"):
        oid = obj.get("id")
        seen.add(oid)
        if oid not in build_ids:
            errors.append(f"model_settings.config describes object {oid}, which is not on the build")
        meta = {m.get("key"): m.get("value") for m in obj.findall("metadata")}
        for k, v in meta.items():
            if k == "extruder":
                if not (v or "").isdigit() or not 1 <= int(v) <= max(n, 1):
                    errors.append(f"object {oid}: filament {v} is not one of the project's 1..{n}")
            elif k not in OBJECT_KEYS:
                if k not in PER_OBJECT:
                    errors.append(f"object {oid}: unknown per-object setting {k!r}")
                else:
                    err = _value_error(k, v or "")
                    if err:
                        errors.append(f"object {oid}: {err}")
        for part in obj.findall("part"):
            for m in part.findall("metadata"):
                if m.get("key") == "extruder" and not (
                        (m.get("value") or "").isdigit() and 1 <= int(m.get("value")) <= max(n, 1)):
                    errors.append(f"object {oid} part {part.get('id')}: filament {m.get('value')} is not one of 1..{n}")
    for oid in build_ids:
        if oid not in seen:
            errors.append(f"build item {oid} has no entry in model_settings.config")
    plates = cfg.findall("plate")
    if not plates:
        errors.append("model_settings.config has no <plate>")
    on_plates = []
    for i, plate in enumerate(plates, 1):
        meta = {m.get("key"): m.get("value") for m in plate.findall("metadata")}
        if meta.get("plater_id") != str(i):
            errors.append(f"plate {i} has plater_id {meta.get('plater_id')!r}")
        for inst in plate.findall("model_instance"):
            im = {m.get("key"): m.get("value") for m in inst.findall("metadata")}
            if im.get("object_id") not in build_ids:
                errors.append(f"plate {i} holds object {im.get('object_id')}, which is not on the build")
            on_plates.append(im.get("object_id"))
    for oid in build_ids:
        if on_plates.count(oid) != 1:
            errors.append(f"object {oid} is on {on_plates.count(oid)} plates, not one")


def check_file(path: str | Path) -> dict:
    """{"ok", "kind" ("bambu_project" or "3mf"), "errors"} for one 3MF file."""
    errors: list[str] = []
    kind = "3mf"
    try:
        with zipfile.ZipFile(path) as z:
            root, _ = _check_package(z, errors)
            if root is not None:
                app = next((m.text or "" for m in root.findall(f"{CORE}metadata") if m.get("name") == "Application"), "")
                if app.startswith("BambuStudio-"):
                    kind = "bambu_project"
                    _check_project(z, root, errors)
    except (zipfile.BadZipFile, OSError) as e:
        errors.append(f"not a readable 3MF (zip) file: {e}")
    except (AttributeError, TypeError, ValueError) as e:   # missing elements or attributes the checks expect
        errors.append(f"malformed 3MF: {type(e).__name__}: {e}")
    return {"ok": not errors, "kind": kind, "errors": errors}


def main(argv) -> int:
    if not argv:
        print(__doc__)
        return 2
    res = {a: check_file(a) for a in argv}
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0 if all(r["ok"] for r in res.values()) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
