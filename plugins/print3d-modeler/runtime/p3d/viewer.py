"""確認用 3D ビューア（viewer.html）を作る。three.js を同梱スクリプトとして埋め込むので、オフラインでもアーティファクト内でも開ける。

    python -m p3d.viewer <モデルフォルダ>

埋め込むもの:
  parts.json + out/parts/*.stl   部位メッシュ・ラベル・主要寸法・印刷向き・オブジェクト（print_group）
  analysis.json                  外形寸法・プリンタ設定・サポート判定の角度（数値の一覧はビューアに出さない）
"""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np
import trimesh

VIEWER_DIR = Path(__file__).resolve().parent.parent / "viewer"
TEMPLATE = VIEWER_DIR / "viewer_template.html"
VENDOR = VIEWER_DIR / "vendor"
DATA_PH = "/*__MODEL_DATA__*/null"
MAP_PH = "/*__THREE_BUNDLE__*/"


def three_bundle() -> str:
    """three.js 本体＋OrbitControls＋CSS2DRenderer を 1 本にまとめたスクリプト（vendor/three-bundle.js）。

    作り方: vendor/three-bundle.entry.js を esbuild で --bundle --minify --format=iife した物。
    """
    js = (VENDOR / "three-bundle.js").read_text(encoding="utf-8")
    return js.replace("</script", "<\\/script")


def build_viewer(d: str | Path) -> Path:
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
        "model": pj["model"], "title": pj["title"], "units": "mm",
        "axes": {"up": "+Z", "front": "-Y", "right": "+X"},
        "size_mm": analysis["summary"]["size_mm"],
        "built_at": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "printer": {"name": pr["name"], "build_volume_mm": pr["build_volume_mm"], "nozzle_mm": pr["nozzle_mm"],
                    "overhang_limit_deg": pr["overhang_limit_deg"]},
        "parts": parts, "objects": objects, "overlays": overlays, "features": pj.get("features", []),
        "groups": groups,
    }

    html = TEMPLATE.read_text(encoding="utf-8")
    assert DATA_PH in html and MAP_PH in html, "viewer_template.html の差し込み位置が見つかりません"
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = html.replace(MAP_PH, three_bundle()).replace(DATA_PH, payload)
    out = d / "viewer.html"
    out.write_text(html, encoding="utf-8")
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    print(build_viewer(sys.argv[1]))
