"""Model folder layout and file helpers shared by every p3d module.

    <model folder>/
      parts.json            part definitions (written by LabeledModel.build)
      analysis.json         automatic printability measurements (written by p3d.analyze)
      viewer.html           3D viewer (written by p3d.viewer)
      out/parts/<id>.stl    mesh per part, design pose
      out/print/<group>.stl one piece per print_group, print pose
      out/final/            print files (written by p3d.export)
"""
from __future__ import annotations

import json
from pathlib import Path

import trimesh

PARTS_JSON = "parts.json"
ANALYSIS_JSON = "analysis.json"
VIEWER_HTML = "viewer.html"


def read_json(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path: Path, data, **kwargs) -> None:
    """Write UTF-8 JSON with non-ASCII text kept readable. kwargs go to json.dumps (such as default=)."""
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2, **kwargs), encoding="utf-8")


def part_stl(d: Path, part_id: str) -> Path:
    return Path(d) / "out" / "parts" / f"{part_id}.stl"


def print_stl(d: Path, group: str) -> Path:
    return Path(d) / "out" / "print" / f"{group}.stl"


def load_mesh(path: Path) -> trimesh.Trimesh:
    return trimesh.load_mesh(path, process=True)


def load_dir(d: str | Path) -> tuple[dict, dict[str, trimesh.Trimesh]]:
    """parts.json and the design-pose mesh of every part, keyed by part id (in parts.json order)."""
    d = Path(d)
    pj = read_json(d / PARTS_JSON)
    return pj, {p["id"]: load_mesh(part_stl(d, p["id"])) for p in pj["parts"]}
