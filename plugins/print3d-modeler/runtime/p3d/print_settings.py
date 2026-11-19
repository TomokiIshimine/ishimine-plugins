"""Slicer settings chosen for a model (walls, infill, supports, brim, layer height) and the bed type.

    python -m p3d.print_settings <model folder>     JSON: the settings, what each piece ends up with, the facts from
                                                   analysis.json that bear on them, and warnings

The print-settings reviewer reads that JSON; p3d.export puts the same object in its output as `print_settings`.

model.py names them in plain words with LabeledModel.set_print_settings, for the whole model or for one piece
(print_group). parts.json keeps those words under "print_settings"; p3d.export turns them into Bambu Studio settings
(p3d.bambu) and lists them for the print notes. Anything not named stays as the slicer's own preset has it.

How Bambu Studio takes them from a project 3MF (BambuStudio src/libslic3r PresetBundle::load_config_file_config,
PresetCollection::load_external_preset, November 2026):
  - whole model: a value in Metadata/project_settings.config counts only when its key is also listed in
    different_settings_to_system[0] (keys joined with ";"); every key not listed is reset to the system preset's value.
    The system process preset is then selected as "modified".
  - one piece: <metadata key="..." value="..."/> on the piece's <object> in Metadata/model_settings.config. Only
    per-object keys work there (PrintObjectConfig / PrintRegionConfig); layer_height would, but stays model-wide here
    so every piece on a plate keeps the same layers.
  - bed type: curr_bed_type in project_settings.config, no listing needed. A project without it opens on Cool Plate,
    while every Bambu Lab printer's own default is the Textured PEI Plate.
  - values are strings. A value of the wrong type makes Bambu Studio drop the project's settings, so every value here
    is checked against the options Bambu Studio accepts (src/libslic3r/PrintConfig.cpp).
"""
from __future__ import annotations

# plain name -> (Bambu Studio key, per piece?, short description for errors and docs)
SETTINGS = {
    "layer_height": ("layer_height", False, "layer height in mm (whole model only)"),
    "walls": ("wall_loops", True, "number of walls (perimeters), 1-20"),
    "top_layers": ("top_shell_layers", True, "solid layers on top, 0-30"),
    "bottom_layers": ("bottom_shell_layers", True, "solid layers at the bottom, 0-30"),
    "infill": ("sparse_infill_density", True, "infill density in percent, 0-100"),
    "infill_pattern": ("sparse_infill_pattern", True, "infill pattern"),
    "supports": ("enable_support", True, 'supports: "none", "normal" or "tree"'),
    "supports_from_bed_only": ("support_on_build_plate_only", True, "supports only where they stand on the bed"),
    "brim": ("brim_type", True, 'brim: "auto", "none", "outer" or "ears"'),
    "brim_width": ("brim_width", True, "brim width in mm, 0-20"),
}

INFILL_PATTERNS = ("grid", "gyroid", "cubic", "honeycomb", "triangles", "lightning", "crosshatch", "zig-zag",
                   "line", "concentric", "adaptivecubic", "tri-hexagon")
SUPPORTS = {"none": None, "normal": "normal(auto)", "tree": "tree(auto)"}
BRIMS = {"auto": "auto_brim", "none": "no_brim", "outer": "outer_only", "ears": "brim_ears"}

# printer.json "bed_type" -> Bambu Studio curr_bed_type (BedType in PrintConfig.cpp)
BED_TYPES = {"textured_pei": "Textured PEI Plate", "smooth_pei": "High Temp Plate", "cool": "Cool Plate",
             "engineering": "Engineering Plate", "supertack": "Supertack Plate"}
DEFAULT_BAMBU_BED = "textured_pei"   # default_bed_type of every Bambu Lab printer in resources/profiles/BBL.json


def _int(name, v, lo, hi):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != int(v) or not lo <= v <= hi:
        raise ValueError(f"print setting {name} must be a whole number from {lo} to {hi}, not {v!r}")
    return int(v)


def _num(name, v, lo, hi):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not lo <= float(v) <= hi:
        raise ValueError(f"print setting {name} must be a number from {lo:g} to {hi:g}, not {v!r}")
    v = round(float(v), 3)
    return int(v) if v == int(v) and name in ("infill", "brim_width") else v


def _choice(name, v, choices):
    if v not in choices:
        raise ValueError(f"print setting {name} must be one of {', '.join(map(repr, choices))}, not {v!r}")
    return v


def normalize(settings: dict, whole_model: bool = True) -> dict:
    """Check plain-word settings and return them cleaned up. Raises ValueError with what is accepted."""
    out = {}
    for name, v in settings.items():
        if v is None:
            continue
        if name not in SETTINGS:
            raise ValueError(f"unknown print setting {name!r} (choices: {', '.join(SETTINGS)})")
        if not whole_model and not SETTINGS[name][1]:
            raise ValueError(f"print setting {name} applies to the whole model only (call without group)")
        if name == "layer_height":
            out[name] = _num(name, v, 0.04, 1.0)
        elif name == "walls":
            out[name] = _int(name, v, 1, 20)
        elif name in ("top_layers", "bottom_layers"):
            out[name] = _int(name, v, 0, 30)
        elif name == "infill":
            out[name] = _num(name, v, 0, 100)
        elif name == "infill_pattern":
            out[name] = _choice(name, v, INFILL_PATTERNS)
        elif name == "supports":
            out[name] = _choice(name, "none" if v is False else v, tuple(SUPPORTS))
        elif name == "supports_from_bed_only":
            if not isinstance(v, bool):
                raise ValueError(f"print setting {name} must be True or False, not {v!r}")
            out[name] = v
        elif name == "brim":
            out[name] = _choice(name, "none" if v is False else v, tuple(BRIMS))
        elif name == "brim_width":
            out[name] = _num(name, v, 0, 20)
    return out


def _fmt(v: float) -> str:
    return f"{v:g}"


def bambu_values(settings: dict) -> dict[str, str]:
    """Plain-word settings (already normalized) -> Bambu Studio keys and string values."""
    out = {}
    for name, v in settings.items():
        key = SETTINGS[name][0]
        if name == "infill":
            out[key] = f"{_fmt(v)}%"
        elif name == "supports":
            out["enable_support"] = "0" if v == "none" else "1"
            if SUPPORTS[v]:
                out["support_type"] = SUPPORTS[v]
        elif name == "supports_from_bed_only":
            out[key] = "1" if v else "0"
        elif name == "brim":
            out[key] = BRIMS[v]
        elif isinstance(v, float):
            out[key] = _fmt(v)
        else:
            out[key] = str(v)
    return out


def bed_type(printer: dict) -> str | None:
    """The printer's bed type key (printer.json "bed_type"; Bambu Lab printers default to the Textured PEI Plate)."""
    v = printer.get("bed_type")
    if v is None:
        return DEFAULT_BAMBU_BED if str(printer.get("preset") or "").startswith("bambu-") else None
    if v not in BED_TYPES:
        raise ValueError(f"bed_type must be one of {', '.join(BED_TYPES)}, not {v!r}")
    return v


def check_layer_height(settings: dict, nozzle_mm: float) -> str | None:
    """A problem with the model-wide layer height for this nozzle, or None (FDM rule of thumb: 25-75 % of it)."""
    lh = settings.get("layer_height")
    if lh is None:
        return None
    lo, hi = 0.25 * nozzle_mm, 0.75 * nozzle_mm
    if not lo - 1e-9 <= lh <= hi + 1e-9:
        return (f"layer height {lh:g} mm is outside {lo:g}-{hi:g} mm (25-75 % of the {nozzle_mm:g} mm nozzle): "
                "the slicer may refuse it or the layers may not bond")
    return None


def summarize(pj: dict, printer: dict, process_preset: str | None, analysis: dict) -> dict:
    """The settings in parts.json, what each piece ends up with, the analysis facts that bear on them, and warnings.

    process_preset: the Bambu Studio process preset the settings change (None: the 3MF carries no settings).
    """
    src = pj.get("print_settings") or {}
    model = normalize(src.get("model") or {})
    groups = {g: normalize(v, whole_model=False) for g, v in (src.get("groups") or {}).items()}
    known = list(pj["print_orientation"]["groups"])
    warnings = [f"Print settings for piece {g}, which no longer exists: ignored" for g in sorted(set(groups) - set(known))]
    groups = {g: v for g, v in groups.items() if g in known}
    problem = check_layer_height(model, float(printer["nozzle_mm"]))
    if problem:
        warnings.append(problem[0].upper() + problem[1:])
    bed = bed_type(printer)
    facts = {g["group"]: g for g in analysis.get("groups", [])}
    pieces = {}
    for g in known:
        # its own settings over the model's; the slicer's preset fills in the rest (Bambu Lab process presets print
        # without supports and with an automatic brim)
        eff = {**model, **groups.get(g, {})}
        needs = [x for x in analysis.get("findings", []) if x.get("check") in ("overhang", "bridge")
                 and str(x.get("issue", "")).startswith(f"[{g}]")]
        fa = facts.get(g, {})
        pieces[g] = {"settings": eff, "support_findings": len(needs),
                     "overhang_area_mm2": fa.get("overhang_area_mm2"),
                     "bed_contact_area_mm2": fa.get("bed_contact_area_mm2"), "size_mm": fa.get("size_mm")}
        if needs and eff.get("supports", "none") == "none":
            warnings.append(f"Piece {g} has faces that need support (analysis: {len(needs)} finding(s)) but prints "
                            "without supports: set supports with set_print_settings, or say in the print notes why "
                            "none are needed")
    return {
        "model": model, "groups": groups, "pieces": pieces, "reason": src.get("reason", ""),
        "nozzle_mm": float(printer["nozzle_mm"]), "material": printer.get("material"),
        "bed_type": bed, "bed_type_name": BED_TYPES.get(bed) if bed else None,
        "in_3mf": process_preset is not None, "process_preset": process_preset,
        "bambu": {"model": bambu_values(model), "groups": {g: bambu_values(v) for g, v in groups.items()}},
        "warnings": warnings,
    }


def main(argv) -> int:
    import json
    import sys
    from pathlib import Path

    from .bambu import project_for
    from .files import ANALYSIS_JSON, PARTS_JSON, read_json
    from .printer import load_printer

    if len(argv) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    d = Path(argv[0])
    pj = read_json(d / PARTS_JSON)
    printer = load_printer(d)
    project = project_for(printer)
    analysis = read_json(d / ANALYSIS_JSON) if (d / ANALYSIS_JSON).is_file() else {}
    print(json.dumps(summarize(pj, printer, project["print_preset"] if project else None, analysis),
                     ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main(sys.argv[1:]))
