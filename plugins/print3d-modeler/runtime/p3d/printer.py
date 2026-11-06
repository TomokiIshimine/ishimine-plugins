"""Load printer settings (build volume, nozzle size, and so on).

Lookup order:
  1. <model folder>/printer.json
  2. <parent of the model folder (print3d/)>/printer.json
  3. Defaults (220×220×250 mm, 0.4 mm nozzle, PLA)

printer.json examples:
  {"preset": "bambu-a1-mini"}                      # use a preset as is
  {"preset": "ender3-v3-se", "nozzle_mm": 0.6}     # preset with some overrides
  {"name": "My custom printer", "build_volume_mm": [200, 200, 180], "nozzle_mm": 0.4}
"""
from __future__ import annotations

import json
from pathlib import Path

from .files import read_json

DEFAULT = {
    "name": "Generic FDM (default)",
    "build_volume_mm": [220, 220, 250],
    "nozzle_mm": 0.4,
    "layer_height_mm": 0.2,
    "material": "PLA",
    "overhang_limit_deg": 45,
    "max_bridge_mm": 10,
    "clearance_mm": [0.2, 0.4],
    "min_bed_contact_mm2": 50,
}

# Build volumes are approximate manufacturer figures. Confirm exact values with the user's printer.
PRESETS = {
    "generic-220": {"name": "Generic FDM 220×220×250", "build_volume_mm": [220, 220, 250]},
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
    return read_json(path) if path.is_file() else None


def resolve(cfg: dict | None) -> dict:
    out = dict(DEFAULT)
    if not cfg:
        out["source"] = "default"
        return out
    preset = cfg.get("preset")
    if preset:
        if preset not in PRESETS:
            raise ValueError(f"Unknown preset: {preset} (choices: {', '.join(PRESETS)})")
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


def main(argv):
    if argv and argv[0] == "--presets":
        for k, v in PRESETS.items():
            print(f"{k:22s} {v['name']:28s} {' × '.join(map(str, v['build_volume_mm']))} mm")
    else:
        print(json.dumps(load_printer(argv[0] if argv else "."), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main(sys.argv[1:]))
