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
   This creates `out/final/<model>.3mf` (all pieces laid out on the bed) and `out/final/<model>_<group>.stl` (one per piece). The printed JSON is the material for the print notes.
5. Write `<model_dir>/print-notes.md` in the shape of `${CLAUDE_PLUGIN_ROOT}/skills/model/templates/print-notes.md`, in the user's language.
   - Print orientation (per piece, which face goes down), whether supports are needed and where, whether a brim is needed, recommended settings (layers, walls, infill)
   - Size, volume, weight upper bound, review warnings (`print_notes` and warnings), assembly steps (for multiple pieces)
6. Record "step 7 export" in `history.md`.
7. Give the user clickable links to the 3MF, STL and print notes (in Cowork `computer://<absolute path>`). Tell them the 3MF loads straight into a slicer (Bambu Studio / PrusaSlicer / OrcaSlicer / Cura) with the orientation already set.
