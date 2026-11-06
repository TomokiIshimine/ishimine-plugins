"""Build the 3D viewer (viewer.html). three.js is embedded as an inline script, so it works offline and inside artifacts.

    python -m p3d.viewer <model folder> [--lang en|ja]

UI language (in order of priority):
  1. --lang (or the lang argument of build_viewer)
  2. "lang" in parts.json (LabeledModel(..., lang="ja"))
  3. Detected from the title and part labels: Japanese text -> "ja", otherwise "en"
Part names, descriptions and key_dims come from model.py as written. Write them in the same language.

Embedded data:
  parts.json + out/parts/*.stl   part meshes, labels, key dimensions, print orientation, objects (print_group)
  analysis.json                  overall size, printer settings, overhang angle for the support overlay
                                 (the list of measurements is not shown in the viewer)
"""
from __future__ import annotations

import datetime as dt
import json
import re
import sys
from pathlib import Path

import numpy as np
import trimesh

VIEWER_DIR = Path(__file__).resolve().parent.parent / "viewer"
TEMPLATE = VIEWER_DIR / "viewer_template.html"
VENDOR = VIEWER_DIR / "vendor"
DATA_PH = "/*__MODEL_DATA__*/null"
MAP_PH = "/*__THREE_BUNDLE__*/"
LANGS = ("en", "ja")
_JA_RE = re.compile(r"[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ]")


def three_bundle() -> str:
    """three.js core + OrbitControls + CSS2DRenderer bundled into one script (vendor/three-bundle.js).

    Built by running esbuild on vendor/three-bundle.entry.js with --bundle --minify --format=iife.
    """
    js = (VENDOR / "three-bundle.js").read_text(encoding="utf-8")
    return js.replace("</script", "<\\/script")


def detect_lang(pj: dict) -> str:
    """Guess the UI language from the title and labels: any Japanese text -> "ja", otherwise "en"."""
    texts = [pj.get("title", "")] + [p.get("label", "") for p in pj.get("parts", [])]
    texts += list((pj.get("objects") or {}).values())
    return "ja" if any(_JA_RE.search(str(t)) for t in texts) else "en"


def resolve_lang(pj: dict, lang: str | None = None) -> str:
    for cand in (lang, pj.get("lang")):
        if cand:
            cand = str(cand).lower().split("-")[0]
            if cand not in LANGS:
                raise ValueError(f"Unsupported viewer language: {cand} (choices: {', '.join(LANGS)})")
            return cand
    return detect_lang(pj)


def build_viewer(d: str | Path, lang: str | None = None) -> Path:
    d = Path(d)
    pj = json.loads((d / "parts.json").read_text(encoding="utf-8"))
    analysis = json.loads((d / "analysis.json").read_text(encoding="utf-8"))
    parts = []
    for p in pj["parts"]:
        m = trimesh.load_mesh(d / "out" / "parts" / f"{p['id']}.stl", process=True)
        parts.append({
            "id": p["id"], "label": p["label"], "description": p.get("description", ""),
            "color": p["color"], "anchor": p["anchor"], "key_dims": p.get("key_dims", {}),
            "requirements": p.get("requirements", []), "group": p.get("print_group", "main"),
            "size_mm": p["bbox_mm"]["size"],
            "positions": np.round(m.vertices, 3).ravel().tolist(),
            "indices": m.faces.ravel().astype(int).tolist(),
        })
    groups = {g: {"matrix": v["matrix"], "rotation_deg": v["rotation_deg"], "bed_face": v.get("bed_face", "")}
              for g, v in pj["print_orientation"]["groups"].items()}

    labels = pj.get("objects", {})
    objects = [{"id": g, "label": labels.get(g, g)} for g in groups]

    from .analyze import group_overlays, load_dir
    _, pmeshes = load_dir(d)
    overlays = group_overlays(pj, pmeshes, float(analysis["printer"]["overhang_limit_deg"]))
    pr = analysis["printer"]
    data = {
        "model": pj["model"], "title": pj["title"], "units": "mm", "lang": resolve_lang(pj, lang),
        "axes": {"up": "+Z", "front": "-Y", "right": "+X"},
        "size_mm": analysis["summary"]["size_mm"],
        "built_at": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "printer": {"name": pr["name"], "build_volume_mm": pr["build_volume_mm"], "nozzle_mm": pr["nozzle_mm"],
                    "overhang_limit_deg": pr["overhang_limit_deg"]},
        "parts": parts, "objects": objects, "overlays": overlays, "features": pj.get("features", []),
        "groups": groups,
    }

    html = TEMPLATE.read_text(encoding="utf-8")
    assert DATA_PH in html and MAP_PH in html, "Insertion points not found in viewer_template.html"
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = html.replace(MAP_PH, three_bundle()).replace(DATA_PH, payload)
    out = d / "viewer.html"
    out.write_text(html, encoding="utf-8")
    return out


if __name__ == "__main__":
    args = sys.argv[1:]
    lang = None
    if "--lang" in args:
        i = args.index("--lang")
        if i + 1 >= len(args):
            print(__doc__)
            sys.exit(2)
        lang = args[i + 1]
        del args[i:i + 2]
    if not args:
        print(__doc__)
        sys.exit(2)
    print(build_viewer(args[0], lang=lang))
