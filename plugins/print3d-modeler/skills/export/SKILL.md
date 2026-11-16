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
3. Check the preconditions: both reviews of the latest version (the highest round in `reviews/`) PASS, and the user has said OK.
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
   - Any piece with `fits_bed: false` does not fit the printer at all. Warn the user plainly (size vs. build volume) and do not call the files ready to print; offer to split or scale it (back to model.py).
5. Write `<model_dir>/print-notes.md` in the shape of `${CLAUDE_PLUGIN_ROOT}/skills/model/templates/print-notes.md`, in the user's language.
   - Printer, print orientation (per piece, which face goes down), which plate each piece is on and whether it is turned on the bed (`bed_turn_deg`), whether supports are needed and where, whether a brim is needed, recommended settings (layers, walls, infill)
   - Size, volume, weight upper bound, review warnings (`print_notes` and warnings), assembly steps (for multiple pieces)
6. Record "step 7 export" in `history.md`.
7. Give the user clickable links to the 3MF, STL and print notes (in Cowork `computer://<absolute path>`). Tell them the 3MF loads straight into a slicer (Bambu Studio / OrcaSlicer as a project with its plates; PrusaSlicer / Cura as a plain 3MF) with the orientation and the layout on the bed already set (bed coordinates, front-left corner at 0, 0; if the slicer re-arranges the parts on import, the orientation still holds).
