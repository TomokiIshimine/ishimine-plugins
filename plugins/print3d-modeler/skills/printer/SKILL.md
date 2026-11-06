---
name: printer
description: >
  Use when setting or checking the 3D printer model, build volume, nozzle size or material.
  Triggered by requests like "my printer is an A1 mini", "set the build volume to 180 mm", "switch to a 0.6 nozzle",
  or "/print3d-modeler:printer".
argument-hint: "[printer model or build volume X×Y×Z]"
metadata:
  version: "0.1.0"
---

# Printer settings (build volume and more)

Requested: $ARGUMENTS

Talk to the user in their language. Settings are saved in a `printer.json` file.

- `print3d/printer.json` … shared by every model in that folder (the usual place)
- `print3d/<model>/printer.json` … when one model needs different settings (takes priority)
- If neither exists, defaults apply (220×220×250 mm, 0.4 mm nozzle, PLA, 45° overhang, 10 mm bridge, 0.2–0.4 mm fit clearance)

## Steps

1. Python environment: run `bash "${CLAUDE_PLUGIN_ROOT}/runtime/setup_env.sh"` and use `python` (PY) and `runtime` (RT) from the JSON on the last line (if the variable is not expanded, use `find / -name setup_env.sh -path "*print3d-modeler*" 2>/dev/null | head -1`).
2. List the presets: `cd RT && PY -m p3d.printer --presets`
3. If the model is in the presets, write `{"preset": "<key>"}`; otherwise ask for the build volume in mm and write `{"name": "<model name>", "build_volume_mm": [X, Y, Z]}`. Add overrides if needed:
   ```json
   {"preset": "bambu-a1-mini", "nozzle_mm": 0.4, "material": "PETG"}
   ```
   Overridable keys: `build_volume_mm` `nozzle_mm` `layer_height_mm` `material` `overhang_limit_deg` `max_bridge_mm` `clearance_mm` `min_bed_contact_mm2`
4. Preset build volumes are approximate manufacturer figures, so tell the user "let me know if your printer's actual values differ".
5. Check: `cd RT && PY -m p3d.printer <model_dir or print3d folder>`
6. If a model is in progress, update "Print environment" in its spec.md and rerun model.py to redo the build volume check.
