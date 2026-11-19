---
name: review
description: >
  Use when manually rerunning only the independent reviews of a 3D printing model (printability, requirements and
  print settings). Triggered by requests like "review it again", "check whether it can be printed", "check it meets
  what I asked for", "check the print settings", or "/print3d-modeler:review".
argument-hint: "[model name]"
metadata:
  version: "0.1.0"
---

# Rerun the reviews

Target: $ARGUMENTS (defaults to the most recently updated model)

1. Find the working folder (same as step 1 of the `resume` skill).
2. Python environment: run `bash "${CLAUDE_PLUGIN_ROOT}/runtime/setup_env.sh"` and use `python` (PY) and `runtime` (RT) from the JSON on the last line (if the variable is not expanded, use `find / -name setup_env.sh -path "*print3d-modeler*" 2>/dev/null | head -1`).
3. If model.py is newer than parts.json, first run `cd <model_dir> && PYTHONPATH=RT PY model.py`.
4. Decide the round number N: the highest number in `reviews/iter-*-*.json` + 1 (1 if none).
5. Launch all three with the Agent tool **in parallel, in the same message**. The prompt is only the absolute paths and the round number (no conversation summary):
   - `print3d-modeler:printability-reviewer`
   - `print3d-modeler:requirements-reviewer`
   - `print3d-modeler:print-settings-reviewer`
   ```
   model_dir: <absolute path>
   python: <PY>
   runtime: <RT>
   iteration: <N>
   ```
6. Save the returned JSON to `reviews/iter-<N>-printability.json`, `reviews/iter-<N>-requirements.json` and `reviews/iter-<N>-print-settings.json` (findings are not shown in the viewer; report the results in chat).
7. Report briefly, in the user's language: the three verdicts (PASS/FAIL), serious findings (with part labels and directions), and the number of warnings. If anything FAILs, ask whether to fix it, or fix it following step 5 of the `model` skill (up to 3 rounds).
