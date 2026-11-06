"""プリンタ設定（造形範囲・ノズル径など）の読み込み。

探す順番:
  1. <モデルフォルダ>/printer.json
  2. <モデルフォルダの親（print3d/）>/printer.json
  3. 既定値（220×220×250mm、ノズル 0.4mm、PLA）

printer.json の例:
  {"preset": "bambu-a1-mini"}                      # プリセットをそのまま使う
  {"preset": "ender3-v3-se", "nozzle_mm": 0.6}     # プリセット＋一部上書き
  {"name": "自作機", "build_volume_mm": [200, 200, 180], "nozzle_mm": 0.4}
"""
from __future__ import annotations

import json
from pathlib import Path

DEFAULT = {
    "name": "汎用 FDM（既定値）",
    "build_volume_mm": [220, 220, 250],
    "nozzle_mm": 0.4,
    "layer_height_mm": 0.2,
    "material": "PLA",
    "overhang_limit_deg": 45,
    "max_bridge_mm": 10,
    "clearance_mm": [0.2, 0.4],
    "min_bed_contact_mm2": 50,
}

# 造形範囲は各メーカーの公表値の目安。正確な値はユーザーの機種で確認する。
PRESETS = {
    "generic-220": {"name": "汎用 FDM 220×220×250", "build_volume_mm": [220, 220, 250]},
    "bambu-a1-mini": {"name": "Bambu Lab A1 mini", "build_volume_mm": [180, 180, 180]},
    "bambu-a1": {"name": "Bambu Lab A1", "build_volume_mm": [256, 256, 256]},
    "bambu-p1s": {"name": "Bambu Lab P1S / P1P", "build_volume_mm": [256, 256, 256]},
    "bambu-x1c": {"name": "Bambu Lab X1 Carbon", "build_volume_mm": [256, 256, 256]},
    "prusa-mk4": {"name": "Prusa MK4 / MK4S", "build_volume_mm": [250, 210, 220]},
    "prusa-core-one": {"name": "Prusa CORE One", "build_volume_mm": [250, 220, 270]},
    "prusa-mini": {"name": "Prusa MINI+", "build_volume_mm": [180, 180, 180]},
    "ender3-v3-se": {"name": "Creality Ender-3 V3 SE", "build_volume_mm": [220, 220, 250]},
    "ender3-v3-ke": {"name": "Creality Ender-3 V3 KE", "build_volume_mm": [220, 220, 240]},
    "creality-k1": {"name": "Creality K1 / K1C", "build_volume_mm": [220, 220, 250]},
    "creality-k1-max": {"name": "Creality K1 Max", "build_volume_mm": [300, 300, 300]},
    "elegoo-neptune4-pro": {"name": "ELEGOO Neptune 4 Pro", "build_volume_mm": [225, 225, 265]},
    "anycubic-kobra3": {"name": "Anycubic Kobra 3", "build_volume_mm": [250, 250, 260]},
}


def _read(path: Path) -> dict | None:
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def resolve(cfg: dict | None) -> dict:
    out = dict(DEFAULT)
    if not cfg:
        out["source"] = "default"
        return out
    preset = cfg.get("preset")
    if preset:
        if preset not in PRESETS:
            raise ValueError(f"未知のプリセット: {preset}（候補: {', '.join(PRESETS)}）")
        out.update(PRESETS[preset])
    out.update({k: v for k, v in cfg.items() if k != "preset"})
    out["preset"] = preset
    return out


def load_printer(model_dir: str | Path) -> dict:
    model_dir = Path(model_dir)
    for cand in (model_dir / "printer.json", model_dir.parent / "printer.json"):
        cfg = _read(cand)
        if cfg is not None:
            p = resolve(cfg)
            p["source"] = str(cand)
            return p
    return resolve(None)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--presets":
        for k, v in PRESETS.items():
            print(f"{k:22s} {v['name']:28s} {' × '.join(map(str, v['build_volume_mm']))} mm")
    else:
        print(json.dumps(load_printer(sys.argv[1] if len(sys.argv) > 1 else "."), ensure_ascii=False, indent=2))
