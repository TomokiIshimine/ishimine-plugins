---
name: export
description: >
  Use when writing the final 3MF / STL of a finished 3D printing model, placed in print orientation, together with print notes.
  Triggered by requests like "export the STL", "save it as 3MF", "give me the files to print", or "/print3d-modeler:export".
argument-hint: "[model name]"
metadata:
  version: "0.1.0"
---

# Final export

Target: $ARGUMENTS (defaults to the most recently updated model)

1. Find the working folder (same as step 1 of the `resume` skill).
2. Python environment: run `bash "${CLAUDE_PLUGIN_ROOT}/runtime/setup_env.sh"` and use `python` (PY) and `runtime` (RT) from the JSON on the last line (if the variable is not expanded, use `find / -name setup_env.sh -path "*print3d-modeler*" 2>/dev/null | head -1`).
3. Check the preconditions: all three reviews of the latest version (the highest round in `reviews/`) PASS, and the user has said OK.
   If not, explain the state and let the user choose with AskUserQuestion between "review first, then export" and "export as is (with the risks stated)".
4. Export:
   ```bash
   cd RT && PY -m p3d.export <model_dir>
   ```
   This creates `out/final/<model>.3mf` (all pieces laid out on the printer's bed) and `out/final/<model>_<group>.stl` (one per piece). The printed JSON is the material for the print notes.
   - Bambu Lab printers (`slicer_project` is set): the 3MF is a Bambu Studio project. Every plate is in this one file, each piece on its own plate, and opening it selects the printer, the process (`slicer_project.print_preset`) and the filament (`slicer_project.filament_preset`, Bambu PLA Basic). Open it with File > Open Project (or double-click it) in Bambu Studio or OrcaSlicer; if the user prints another material, they pick their filament after opening.
   - The layout comes from the last model.py run, made for the printer in `printer` (`p3d.printer`). If `layout.made_for_current_printer` is false, the printer changed since: rerun model.py and export again.
   - When the pieces need more than one plate, tell the user clearly, before the links: how many print runs, and which pieces are on each plate (`groups[].plate`). With a Bambu Lab printer they are plates 1, 2… of the one 3MF (`layout.one_file` is true). With other printers plain 3MF has no plates, so there is one `out/final/<model>_plate<N>.3mf` per plate instead.
   - Do not merge per-plate files into one 3MF by hand: a 3MF without Bambu Studio's project settings is opened as geometry only, and every piece lands on plate 1.
   - **Multi-color models** (`multicolor` is true; `filaments` lists filament 1, 2… with color, material, preset and weight): each piece is one object made of one part per filament, so opening the 3MF shows the colors already assigned. With a Bambu Lab printer the project's filaments carry the colors and presets; tell the user that the AMS slots do not need to match: when they send the job, Bambu Studio maps each filament to a loaded one by type and color, and they can change the mapping on that screen. With other printers the 3MF carries the colors as 3MF base materials (Bambu Studio and OrcaSlicer read them; in other slicers assign the filaments by hand, using the per-filament STLs in `files.filament_stl` if needed).
   - **Materials not decided** (`material_decided: false`, also listed in `layout.warnings`): they were written as the printer's material. Ask the user once with AskUserQuestion whether to decide now (offer PLA, PETG and the materials they mentioned) or later in the slicer. If they decide now, export again with `PY -m p3d.export <model_dir> --material <filament>=<material>` (repeat per filament; no rebuild needed) and also write the material into that `add_filament` in model.py so later builds keep it. If a material has no preset for the printer (a warning says so), the filament was written as PLA and must be chosen in Bambu Studio.
   - **Format check** (`format_check`): every 3MF written is checked by `p3d.check3mf` (package, meshes, Bambu Studio project files and settings). If `format_check.ok` is false, do not hand the files over or call them ready: report the errors and fix the cause (rerun model.py and export; if it persists it is a plugin bug, say so).
   - **Print settings** (`print_settings`): the settings from `set_print_settings` (`model`, `groups`, what each piece ends up with in `pieces`), the bed type, and with a Bambu Lab printer (`in_3mf` true) that they are in the 3MF: opening it selects the process preset as "modified" with these values, and pieces with their own settings show them on the object. Tell the user in one line what was set and why. With other printers, the settings are for the user to set by hand (from the print notes). Warnings about the settings are in `layout.warnings`.
   - Any piece with `fits_bed: false` does not fit the printer at all. Warn the user plainly (size vs. build volume) and do not call the files ready to print; offer to split or scale it (back to model.py).
5. Write `<model_dir>/print-notes.md` in the shape of `${CLAUDE_PLUGIN_ROOT}/skills/model/templates/print-notes.md`, in the user's language.
   - Printer, print orientation (per piece, which face goes down), which plate each piece is on and whether it is turned on the bed (`bed_turn_deg`), the print settings from `print_settings` (supports and where, brim, walls, infill, layer height, bed type, the reason, and whether they are already in the 3MF) together with `print_notes` from `reviews/iter-<N>-print-settings.json`
   - Size, volume, weight upper bound, review warnings (`print_notes` and warnings), assembly steps (for multiple pieces)
   - Multi-color: the filament table (number, color, label, material or "not decided", weight upper bound per filament), that the AMS mapping happens when the job is sent, and the rough number of filament changes (`analysis.filaments.estimated_changes`)
6. Record "step 7 export" in `history.md`.
7. Give the user clickable links to the 3MF, STL and print notes (in Cowork `computer://<absolute path>`). Tell them the 3MF loads straight into a slicer (Bambu Studio / OrcaSlicer as a project with its plates; PrusaSlicer / Cura as a plain 3MF) with the orientation and the layout on the bed already set (bed coordinates, front-left corner at 0, 0; if the slicer re-arranges the parts on import, the orientation still holds).
