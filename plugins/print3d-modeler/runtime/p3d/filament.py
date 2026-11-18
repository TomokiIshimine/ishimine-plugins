"""Filaments for multi-color printing: materials, colors, and which filament prints where.

A model names its filaments by color and material (LabeledModel.add_filament), never by AMS slot: the slicer maps
them to whatever is loaded when the job is sent (Bambu Studio matches type and nearest color). A model whose parts
use two or more filaments is a multi-color model; with none or one, every output is the same as for a one-color model.

Where parts of different filaments overlap, the part added later wins: its filament prints the shared volume.
"""
from __future__ import annotations

import re

# canonical material -> density in g/cm³ (the first word is the base material)
MATERIALS = {"PLA": 1.24, "PLA Matte": 1.32, "PLA Silk": 1.32, "PETG": 1.27, "ABS": 1.04, "ASA": 1.07, "TPU": 1.21}
DEFAULT_DENSITY = 1.24
COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def normalize_material(name) -> str | None:
    """Canonical material name ("pla matte" -> "PLA Matte"), None for no material. Raises ValueError if unknown."""
    if name is None or str(name).strip() == "":
        return None
    key = re.sub(r"[\s_\-]+", " ", str(name).strip()).lower()
    for m in MATERIALS:
        if m.lower() == key:
            return m
    raise ValueError(f"Unknown material: {name!r} (choices: {', '.join(MATERIALS)})")


def density(material: str | None) -> float:
    """g/cm³ of a material (also accepts the printer's material, such as "PLA" or "petg")."""
    try:
        m = normalize_material(material)
    except ValueError:
        m = None
    return MATERIALS.get(m, DEFAULT_DENSITY) if m else DEFAULT_DENSITY


def normalize_color(color: str) -> str:
    if not isinstance(color, str) or not COLOR_RE.match(color):
        raise ValueError(f"Filament color must be #RRGGBB: {color!r}")
    return color.upper()


def used_filaments(pj: dict) -> list[dict]:
    """parts.json filaments in slicer order (filament 1, 2, ...). Empty for a model without filaments."""
    return list(pj.get("filaments") or [])


def is_multicolor(pj: dict) -> bool:
    return len(used_filaments(pj)) >= 2


def resolve_overlaps(meshes: list, filaments: list[str]) -> dict:
    """Split parts of one piece by filament, the later part winning where parts of different filaments overlap.

    meshes[i] is part i (in the order the parts were added), filaments[i] its filament id. Returns
    {filament id: mesh} for the filaments that keep some volume, in order of first use. The union of the result
    is the fused piece.
    """
    from .meshutil import boolean
    out: dict = {}
    for mesh, fid in zip(meshes, filaments):
        for other in list(out):
            if other != fid and out[other] is not None:
                rest = boolean([out[other], mesh], "difference")
                if rest is None:
                    raise RuntimeError(f"Could not cut filament {other} where a later part overlaps it "
                                       "(a shape may not be closed)")
                out[other] = rest if len(rest.faces) else None
        if out.get(fid) is None:
            out[fid] = mesh.copy()
        else:
            merged = boolean([out[fid], mesh], "union")
            if merged is None:
                raise RuntimeError(f"Could not join the parts of filament {fid} (a shape may not be closed)")
            out[fid] = merged
    return {k: v for k, v in out.items() if v is not None and len(v.faces)}
