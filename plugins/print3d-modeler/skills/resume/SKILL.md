---
name: resume
description: >
  Use when resuming work on an unfinished 3D printing model from the step where it stopped.
  Triggered by requests like "continue the model from earlier", "I want to fix the phone stand I made before",
  or "/print3d-modeler:resume".
argument-hint: "[model name]"
metadata:
  version: "0.1.0"
---

# Resume work

Target: $ARGUMENTS

Talk to the user in their language. If the conversation language differs from the one in spec.md, follow the user (see "Language" in the `model` skill).

1. Find the working folder. Glob for `print3d/*/spec.md` under the folder the user picked (or the output folder if none).
   - If there is an argument, narrow down by model name (folder name) or the title in spec.md.
   - If several candidates remain, let the user choose from up to 4, newest first, with AskUserQuestion.
   - If none is found, suggest creating a new one (the `model` skill).
2. Python environment: run `bash "${CLAUDE_PLUGIN_ROOT}/runtime/setup_env.sh"` and use `python` (PY) and `runtime` (RT) from the JSON on the last line (if the variable is not expanded, use `find / -name setup_env.sh -path "*print3d-modeler*" 2>/dev/null | head -1`).
3. Read the state: `spec.md`, `design.md`, `history.md` (the last `## vN … step X` line), the latest round in `reviews/`, and whether `out/final/` exists.
4. Decide where to resume.
   | State | Resume at |
   |---|---|
   | Only spec.md | Step 2 (design) |
   | Up to design.md, no model.py | Step 3 (implement) |
   | model.py exists but parts.json / viewer.html is missing or stale | Step 4 (run) |
   | No review for the latest version, or FAILs remain | Step 5 (review; continue the round numbering; the 3-round limit is not reset per version) |
   | Reviews PASS, waiting for the user check | Step 6 (rebuild the viewer and show it again) |
   | out/final exists | Done. Ask whether to make more changes or export again |
5. Tell the user in 2–3 lines how far it got and what comes next, then continue with the matching step of the `model` skill (`${CLAUDE_PLUGIN_ROOT}/skills/model/SKILL.md` and `references/workflow.md`).
6. Python paths can change between sessions. model.py finds the runtime through `PYTHONPATH`, so always run it as `PYTHONPATH=RT PY model.py`. For a model.py made with an older version, see the note under "p3d runtime" in `modeling-conventions`.
