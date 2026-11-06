---
name: view
description: >
  Use when reopening (rebuilding) the 3D viewer for a 3D printing model that is in progress or finished.
  Triggered by requests like "show me the viewer again", "I want to check it in 3D", "show the model",
  or "/print3d-modeler:view".
argument-hint: "[model name]"
metadata:
  version: "0.1.0"
---

# Open the viewer

Target: $ARGUMENTS (defaults to the most recently updated model)

1. Find the working folder `print3d/<model name>/` (same as step 1 of the `resume` skill).
2. Python environment: run `bash "${CLAUDE_PLUGIN_ROOT}/runtime/setup_env.sh"` and use `python` (PY) and `runtime` (RT) from the JSON on the last line (if the variable is not expanded, use `find / -name setup_env.sh -path "*print3d-modeler*" 2>/dev/null | head -1`).
3. Rebuild the viewer (does not rebuild the model). Match the UI language to the conversation: `--lang ja` for Japanese, `--lang en` for English or any other language (without it, the `lang` in model.py or auto-detection from the labels is used):
   ```bash
   cd RT && PY -m p3d.viewer <model_dir> --lang <en|ja>
   ```
   If parts.json is missing or older than model.py, first run `cd <model_dir> && P3D_RUNTIME=RT PY model.py`.
   If the part labels are in a different language from the conversation, update the labels and `lang` in model.py and rerun it instead.
4. If a tool for creating artifacts is available, show the contents of `viewer.html` as an artifact as is. Always also give a link to the file (in Cowork `computer://<absolute path>`; it works offline when opened in a browser).
5. Add short usage notes in the user's language, using the button names as they appear in the viewer:
   - Left drag to rotate, wheel to zoom (toward the cursor), right drag to pan, double-click to make that point the rotation center.
   - Hovering a part shows its name (such as "P1 Base"). Together with the directions (up/down, front/back, left/right), the user can give instructions in chat like "make P2 Backrest 10 mm taller".
   - The button at the top right opens the panel, where parts (per object if there are several) can be shown, hidden or made transparent, and part labels, directions, faces likely to need support and the size-reference coin can be toggled.
   - The print orientation button shows how it sits on the bed and the build volume.
