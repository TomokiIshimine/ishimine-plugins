---
name: printer
description: >
  Use when setting, remembering or checking the user's 3D printer model, build volume, nozzle size or material.
  Triggered by requests like "my printer is an A1 mini", "I use a Bambu Lab P1S", "set the build volume to 180 mm",
  "switch to a 0.6 nozzle", "which printer is set?", or "/print3d-modeler:printer".
argument-hint: "[printer model or build volume X×Y×Z]"
metadata:
  version: "0.2.0"
---

# Printer settings (build volume and more)

Requested: $ARGUMENTS

Talk to the user in their language. The printer decides the build volume that every model is checked against and
the bed the printed pieces are laid out on (`p3d.layout`: pieces are turned and packed to fit one plate if they can,
and spread over more plates with a warning if they cannot).

## Where the setting lives (first one found wins)

1. `print3d/<model>/printer.json` … one model needs different settings
2. `print3d/printer.json` … every model in that working folder (the usual place)
3. **The remembered printer**: `printer.json` in the plugin data folder, written by `p3d.printer --save`.
   It applies in every folder, so the user does not have to say their printer again
4. Defaults: 220×220×250 mm, 0.4 mm nozzle, PLA, 45° overhang, 10 mm bridge, 0.2–0.4 mm fit clearance, 6 mm between pieces

Some hosts (for example a fresh cloud or Cowork session) may not keep the plugin data folder between sessions,
so also keep the printer in your own memory if you have one (see step 5).

## Steps

1. Python environment: run `bash "${CLAUDE_PLUGIN_ROOT}/runtime/setup_env.sh"` and use `python` (PY) and `runtime` (RT) from the JSON on the last line (if the variable is not expanded, use `find / -name setup_env.sh -path "*print3d-modeler*" 2>/dev/null | head -1`).
2. Find the preset:
   - `cd RT && PY -m p3d.printer --find "<what the user said>"` (e.g. `"A1 mini"`, `"P1S"`, `"X1 Carbon"`, `"H2D"`)
   - Full list: `cd RT && PY -m p3d.printer --presets`. Bambu Lab: A1 mini, A1, P1P, P1S, P2S, X1 Carbon, X1E, X2D,
     H2S, H2D / H2D Pro, H2C, H3C (checked against bambulab.com in November 2026). Also Prusa, Creality, ELEGOO, Anycubic.
   - Several matches, or only "Bambu" without a model: ask with AskUserQuestion (up to 4 likely models plus free text).
   - Not in the presets: ask for the build volume in mm (X left-right × Y front-back × Z height), from the maker's spec page.
3. Two-nozzle printers (X2D, H2D, H2C): `build_volume_mm` is the single-nozzle printing area. If the user prints
   with both nozzles (two materials or colors in one piece), add `--nozzle-mode dual` to use the smaller area both
   nozzles reach. Ask only when the model needs two materials; otherwise keep single.
4. Save. DIR is the `print3d/` folder under the user's working folder (create it if needed):
   ```bash
   cd RT && PY -m p3d.printer --save DIR --preset <key> [--nozzle 0.6] [--material PETG] [--nozzle-mode dual]
   cd RT && PY -m p3d.printer --save DIR --name "<model name>" --volume 200x200x180 [--nozzle 0.4] [--material PLA]
   ```
   This writes `DIR/printer.json` and the remembered printer. Add `--folder-only` when the user wants these settings
   only for this folder (for example a second printer used for one project). For one model only, write
   `print3d/<model>/printer.json` with the Write tool in the same JSON shape (`{"preset": "<key>", ...}`).
   Other keys that can be set in printer.json: `layer_height_mm` `overhang_limit_deg` `max_bridge_mm` `clearance_mm`
   `min_bed_contact_mm2` `part_spacing_mm` `build_volume_mm`.
5. If you have a persistent memory (a memory tool, memory files, or project memory), save one line there too, in the
   user's language, such as: "3D printer: Bambu Lab A1 mini (print3d-modeler preset bambu-a1-mini), 0.4 mm nozzle, PLA".
   Next time, when `p3d.printer` reports `"source": "default"`, use that line to run step 4 without asking again.
6. Check: `cd RT && PY -m p3d.printer DIR` shows the settings in use and `source` (which file they came from).
   Tell the user the printer and build volume in one line. For presets other than Bambu Lab, add that the figures are
   approximate and to tell you if their printer differs.
7. If a model is in progress, update "Print environment" in its spec.md and rerun model.py: the build volume check
   and the layout on the bed are redone for the new printer (analyze reports a `layout` finding until then).
