"""Printer settings (build volume, nozzle size, material and so on).

    python -m p3d.printer DIR                         show the settings that apply to DIR (a model folder or print3d/)
    python -m p3d.printer --presets                   list the built-in presets
    python -m p3d.printer --find "A1 mini"            match a printer name to a preset key
    python -m p3d.printer --save DIR --preset bambu-a1 [--nozzle 0.6] [--material PETG] [--nozzle-mode dual]
    python -m p3d.printer --save DIR --name "My printer" --volume 200x200x180 [--nozzle 0.4] [--material PLA]

Lookup order (the first file found wins):
  1. <model folder>/printer.json
  2. <parent of the model folder (print3d/)>/printer.json
  3. The remembered printer: printer.json next to the runtime's virtual environment (the plugin data folder),
     written by `--save` so that the user's printer is known in every folder
  4. Defaults (220×220×250 mm, 0.4 mm nozzle, PLA)

`--save DIR` writes DIR/printer.json and also the remembered printer (add `--folder-only` to skip that).

printer.json examples:
  {"preset": "bambu-a1-mini"}                         # use a preset as is
  {"preset": "bambu-h2d", "nozzle_mode": "dual"}      # dual-nozzle printing area of a two-nozzle printer
  {"preset": "ender3-v3-se", "nozzle_mm": 0.6}        # preset with some overrides
  {"name": "My custom printer", "build_volume_mm": [200, 200, 180], "nozzle_mm": 0.4}
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from .files import read_json, write_json

PRINTER_JSON = "printer.json"
VENV_STAMP = ".p3d-requirements"   # written into the venv by setup_env.sh

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
    "part_spacing_mm": 6,
}

OVERRIDABLE = ("build_volume_mm", "nozzle_mm", "layer_height_mm", "material", "overhang_limit_deg",
               "max_bridge_mm", "clearance_mm", "min_bed_contact_mm2", "part_spacing_mm", "nozzle_mode")

# build_volume_mm is [X (left-right), Y (front-back), Z (height)] in mm.
# Bambu Lab figures were checked against bambulab.com spec pages in November 2026. For two-nozzle printers,
# build_volume_mm is the single-nozzle printing area (the left nozzle on the H2C) and dual_nozzle_volume_mm the
# area both nozzles reach (used with "nozzle_mode": "dual"). Other brands are approximate manufacturer figures.
PRESETS = {
    "generic-220": {"name": "Generic FDM 220×220×250", "brand": "Generic", "build_volume_mm": [220, 220, 250]},
    "bambu-a1-mini": {"name": "Bambu Lab A1 mini", "brand": "Bambu Lab", "build_volume_mm": [180, 180, 180]},
    "bambu-a1": {"name": "Bambu Lab A1", "brand": "Bambu Lab", "build_volume_mm": [256, 256, 256]},
    "bambu-p1p": {"name": "Bambu Lab P1P", "brand": "Bambu Lab", "build_volume_mm": [256, 256, 256]},
    "bambu-p1s": {"name": "Bambu Lab P1S", "brand": "Bambu Lab", "build_volume_mm": [256, 256, 256]},
    "bambu-p2s": {"name": "Bambu Lab P2S", "brand": "Bambu Lab", "build_volume_mm": [256, 256, 256]},
    "bambu-x1c": {"name": "Bambu Lab X1 Carbon", "brand": "Bambu Lab", "build_volume_mm": [256, 256, 256],
                  "aliases": ["X1C", "X1", "X1 Carbon"]},
    "bambu-x1e": {"name": "Bambu Lab X1E", "brand": "Bambu Lab", "build_volume_mm": [256, 256, 256]},
    "bambu-x2d": {"name": "Bambu Lab X2D", "brand": "Bambu Lab", "build_volume_mm": [256, 256, 260],
                  "dual_nozzle_volume_mm": [235.5, 256, 256]},
    "bambu-h2s": {"name": "Bambu Lab H2S", "brand": "Bambu Lab", "build_volume_mm": [340, 320, 340]},
    "bambu-h2d": {"name": "Bambu Lab H2D / H2D Pro", "brand": "Bambu Lab", "build_volume_mm": [325, 320, 325],
                  "dual_nozzle_volume_mm": [300, 320, 325], "aliases": ["H2D", "H2D Pro"]},
    "bambu-h2c": {"name": "Bambu Lab H2C", "brand": "Bambu Lab", "build_volume_mm": [325, 320, 320],
                  "dual_nozzle_volume_mm": [300, 320, 320]},
    "bambu-h3c": {"name": "Bambu Lab H3C", "brand": "Bambu Lab", "build_volume_mm": [330, 320, 325]},
    "prusa-mk4": {"name": "Prusa MK4 / MK4S", "brand": "Prusa", "build_volume_mm": [250, 210, 220]},
    "prusa-core-one": {"name": "Prusa CORE One", "brand": "Prusa", "build_volume_mm": [250, 220, 270]},
    "prusa-mini": {"name": "Prusa MINI+", "brand": "Prusa", "build_volume_mm": [180, 180, 180]},
    "ender3-v3-se": {"name": "Creality Ender-3 V3 SE", "brand": "Creality", "build_volume_mm": [220, 220, 250]},
    "ender3-v3-ke": {"name": "Creality Ender-3 V3 KE", "brand": "Creality", "build_volume_mm": [220, 220, 240]},
    "creality-k1": {"name": "Creality K1 / K1C", "brand": "Creality", "build_volume_mm": [220, 220, 250]},
    "creality-k1-max": {"name": "Creality K1 Max", "brand": "Creality", "build_volume_mm": [300, 300, 300]},
    "elegoo-neptune4-pro": {"name": "ELEGOO Neptune 4 Pro", "brand": "ELEGOO", "build_volume_mm": [225, 225, 265]},
    "anycubic-kobra3": {"name": "Anycubic Kobra 3", "brand": "Anycubic", "build_volume_mm": [250, 250, 260]},
}
PRESET_ONLY_KEYS = ("brand", "aliases", "dual_nozzle_volume_mm")


def _read(path: Path) -> dict | None:
    return read_json(path) if path.is_file() else None


def user_printer_path() -> Path | None:
    """printer.json in the plugin data folder (the parent of the venv setup_env.sh made), or None outside that venv."""
    venv = Path(sys.prefix)
    if (venv / VENV_STAMP).is_file():
        return venv.parent / PRINTER_JSON
    return None


def resolve(cfg: dict | None) -> dict:
    out = dict(DEFAULT)
    if not cfg:
        out["source"] = "default"
        return out
    preset = cfg.get("preset")
    if preset:
        if preset not in PRESETS:
            raise ValueError(f"Unknown preset: {preset} (choices: {', '.join(PRESETS)})")
        out.update({k: v for k, v in PRESETS[preset].items() if k not in ("brand", "aliases")})
    out.update({k: v for k, v in cfg.items() if k != "preset"})
    out["preset"] = preset
    mode = out.get("nozzle_mode", "single")
    if mode not in ("single", "dual"):
        raise ValueError(f"nozzle_mode must be single or dual, not {mode}")
    if mode == "dual" and "build_volume_mm" not in cfg:
        if not out.get("dual_nozzle_volume_mm"):
            raise ValueError(f"{out['name']} has no dual-nozzle printing area (nozzle_mode: dual)")
        out["build_volume_mm"] = list(out["dual_nozzle_volume_mm"])
    return out


def load_printer(model_dir: str | Path) -> dict:
    model_dir = Path(model_dir)
    cands = [model_dir / PRINTER_JSON, model_dir.parent / PRINTER_JSON]
    remembered = user_printer_path()
    if remembered is not None:
        cands.append(remembered)
    for cand in cands:
        cfg = _read(cand)
        if cfg is not None:
            p = resolve(cfg)
            p["source"] = str(cand)
            p["remembered"] = cand == remembered
            return p
    return resolve(None)


# --------------------------------------------------------------------- name matching
def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower().replace("bambu lab", "").replace("bambulab", ""))


def find_preset(text: str) -> list[str]:
    """Preset keys whose name, key or aliases match text ("a1 mini", "P1S", "X1 Carbon"), best first."""
    q = _norm(text)
    if not q:
        return []
    exact, partial = [], []
    for key, v in PRESETS.items():
        names = [key, key.split("-", 1)[-1], v["name"], *v.get("aliases", []), *v["name"].split(" / ")]
        normed = {_norm(n) for n in names}
        if q in normed:
            exact.append(key)
        elif any(q in n for n in normed if n):
            partial.append(key)
    return exact or partial


# --------------------------------------------------------------------- CLI
def _volume(text: str) -> list[float]:
    vals = [float(v) for v in re.split(r"[x×*, ]+", text.strip()) if v]
    if len(vals) != 3:
        raise argparse.ArgumentTypeError("give the build volume as X×Y×Z in mm, e.g. 256x256x256")
    return vals


def save(target_dir: Path, cfg: dict, folder_only: bool = False) -> dict:
    resolve(cfg)   # fail before writing anything if the settings are invalid
    target_dir.mkdir(parents=True, exist_ok=True)
    written = [target_dir / PRINTER_JSON]
    remembered = None if folder_only else user_printer_path()
    if remembered is not None:
        written.append(remembered)
    for path in written:
        write_json(path, cfg)
    return {"saved": [str(p) for p in written], "remembered": remembered is not None, "settings": resolve(cfg)}


def _list_presets() -> None:
    brand = None
    for k, v in PRESETS.items():
        if v["brand"] != brand:
            brand = v["brand"]
            print(f"# {brand}")
        dual = v.get("dual_nozzle_volume_mm")
        extra = f"   (dual-nozzle printing: {' × '.join(map(str, dual))} mm)" if dual else ""
        print(f"{k:22s} {v['name']:28s} {' × '.join(map(str, v['build_volume_mm']))} mm{extra}")


def main(argv):
    ap = argparse.ArgumentParser(prog="python -m p3d.printer", description=__doc__.split("\n\n")[0])
    ap.add_argument("dir", nargs="?", default=".", help="model folder or print3d/ folder")
    ap.add_argument("--presets", action="store_true", help="list the presets")
    ap.add_argument("--find", metavar="NAME", help="match a printer name to preset keys")
    ap.add_argument("--save", metavar="DIR", help="write DIR/printer.json and remember it as the user's printer")
    ap.add_argument("--folder-only", action="store_true", help="with --save: do not change the remembered printer")
    ap.add_argument("--preset")
    ap.add_argument("--name")
    ap.add_argument("--volume", type=_volume, metavar="XxYxZ")
    ap.add_argument("--nozzle", type=float)
    ap.add_argument("--material")
    ap.add_argument("--nozzle-mode", choices=["single", "dual"])
    a = ap.parse_args(argv)
    try:
        return _run(ap, a)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


def _run(ap: argparse.ArgumentParser, a: argparse.Namespace) -> int:

    if a.presets:
        _list_presets()
        return 0
    if a.find:
        keys = find_preset(a.find)
        print(json.dumps([{"preset": k, **{f: PRESETS[k][f] for f in ("name", "build_volume_mm")}} for k in keys],
                         ensure_ascii=False, indent=2))
        return 0 if keys else 1
    if a.save:
        if not (a.preset or (a.name and a.volume)):
            ap.error("--save needs --preset, or --name together with --volume")
        cfg = {"preset": a.preset} if a.preset else {"name": a.name}
        for key, val in (("name", a.name if a.preset else None), ("build_volume_mm", a.volume),
                         ("nozzle_mm", a.nozzle), ("material", a.material), ("nozzle_mode", a.nozzle_mode)):
            if val is not None:
                cfg[key] = val
        print(json.dumps(save(Path(a.save), cfg, a.folder_only), ensure_ascii=False, indent=2))
        return 0
    p = load_printer(a.dir)
    p["remembered_printer_file"] = str(user_printer_path() or "")
    print(json.dumps(p, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
