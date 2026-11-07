---
name: model
description: >
  Use when designing and creating a new model to print on an FDM 3D printer, working through it with the user.
  Triggered by requests like "I want to 3D print a ...", "make a phone stand model", "make an STL for 3D printing",
  "design a part I can print", or "/print3d-modeler:model". Runs the whole flow: hearing → design → implementation
  in Python (build123d) → two independent reviews → user check in a 3D viewer → print-ready STL/3MF export.
argument-hint: "[what to make]"
metadata:
  version: "0.1.0"
---

# Create a model for 3D printing (entry point)

Turn the user's "I want to make something like this" into files they can print as is on an FDM 3D printer.
You (the main agent) do the conversation, design, implementation, runs and export yourself. Only the reviews go to two independent subagents.

What to make (argument): $ARGUMENTS

## Read first

- The `modeling-conventions` skill (coordinate system, part naming, folder layout, how to write model.py). The coordinate system is fixed: **up = +Z (Z=0 is the bed), front = −Y, right = +X, millimeters**.
- Detailed steps for each stage: `${CLAUDE_PLUGIN_ROOT}/skills/model/references/workflow.md`
- Sample hearing questions: `${CLAUDE_PLUGIN_ROOT}/skills/model/references/hearing.md`

## Language

These instructions are in English, but **talk to the user in the language they write in** (if they switch, switch with them). Use that language for everything the user sees:

- Your messages and AskUserQuestion questions and options.
- What the viewer shows: the model `title`, part `label`, `description`, `key_dims` names, object labels (`set_object_label`), and feature labels.
- Files the user may open: `spec.md`, `design.md`, `print-notes.md`. Translate the template headings, but keep their structure.
- **Viewer language:** pass `lang` to `LabeledModel` to match: `"ja"` for Japanese, `"en"` for English and for any other language (the viewer UI has English and Japanese; part labels still show in the user's language). If you leave it out, the viewer picks Japanese when the labels contain Japanese and English otherwise. `p3d.viewer DIR --lang ja|en` overrides it when rebuilding only the viewer.

Keep identifiers in English in every language: part ids, file and folder names, JSON keys, requirement IDs (R1, R2…), and the `## vN (date) step X → step Y` header lines in `history.md`. Measurement output (`p3d.analyze`, `p3d.measure`) is in English; translate it when you relay it.

## Setup (once, in parallel with the hearing)

1. Prepare the Python environment. The first run spends a few minutes installing dependencies (build123d and others), so run Bash in the background and start the hearing without waiting.

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/runtime/setup_env.sh"
   ```

   If `${CLAUDE_PLUGIN_ROOT}` is not expanded, find it with `find / -name setup_env.sh -path "*print3d-modeler*" 2>/dev/null | head -1`.
   Use `python` (PY below) and `runtime` (RT below) from the JSON on the last line in every later command.
2. Choose the working folder. Create `print3d/<model-name>/` directly under the folder the user picked (connected), or under the output folder if there is none. The model name is a lowercase slug (for example `phone-stand`).

## Steps and when they are done

| Step | What to do | Done when |
|---|---|---|
| 1. Hearing | Ask about purpose, size, shape, movement/assembly, and printing setup | `spec.md` (requirements R1, R2…) and `print3d/printer.json` exist |
| 2. Design | Decide the parts, dimensions and candidate print orientations; confirm the key points | `design.md` and a confirmed part list |
| 3. Implement | Write `model.py` (one `add_part` per part) | `model.py` exists |
| 4. Run and self-check | Run `PYTHONPATH=RT PY model.py` and fix obvious failures yourself | `parts.json` `analysis.json` `out/` `viewer.html` exist |
| 5. Review | Launch the two reviewers in parallel → fix FAILs and review again (up to 3 rounds) | `reviews/iter-N-*.json` |
| 6. User check | Have the user look at the viewer and give instructions in chat | Feedback added to `spec.md` (→ back to step 2 or 3) / the user says OK |
| 7. Export | Write STL/3MF in print orientation and the print notes | `out/final/*.3mf` `*.stl` `print-notes.md` |

At the end of each step, record 1–3 lines in `history.md` (`resume` uses it to decide where to pick up).

## Rules

- **Do not do the review yourself.** Never go to the user check (step 6) or the final export (step 7) without passing step 5.
- Do not give the reviewers a summary of the conversation. Pass only absolute paths (model folder, PY, RT) and the round number. Keep every piece of evidence in `spec.md` and the files.
- Ask the user with AskUserQuestion, 1–3 topics at a time, with options. Rephrase technical terms (for example: "overhang (a part whose underside hangs in the air and needs support material underneath)").
- When printability and the user's wishes conflict (for example, the wall they want is too thin), do not decide alone. Lay out alternatives and let the user choose.
- Map the user's instructions to part labels (`label` in `parts.json`) and directions (up/down, front/back, left/right), add them to `spec.md` as requirements, then make the change. If an instruction is ambiguous, ask back with AskUserQuestion.
- Directions always refer to the model as used. The print orientation is kept separately as a rotation in `set_print_orientation`.
- When showing the viewer, if a tool for creating artifacts is available, show the contents of `viewer.html` as an artifact as is (it is a single self-contained file that loads nothing external). Always also give a link to the file (in Cowork use the `computer://<absolute path>` form; it works offline when opened in a browser).

## Launching the reviews (step 5)

Launch both with the Agent tool **in parallel, in the same message**.

- `print3d-modeler:printability-reviewer` … can it be printed?
- `print3d-modeler:requirements-reviewer` … does it meet the requirements?

The prompt contains only this (example):

```
model_dir: /abs/path/print3d/phone-stand
python: /abs/path/venv/bin/python
runtime: /abs/path/print3d-modeler/runtime
iteration: 1
```

Save the returned JSON as is to `reviews/iter-<N>-printability.json` and `reviews/iter-<N>-requirements.json`.
If both PASS, go to step 6. If anything FAILs, fix it, run again and review again (N+1). Anything still open after 3 rounds: summarize the finding, cause and options, and ask the user to decide with AskUserQuestion.
Ask the `questions_for_user` from `requirements-reviewer` (requirements it could not judge) with AskUserQuestion in step 6.

## User check (step 6)

1. Show the viewer (already built in step 4; if missing, run `cd RT && PY -m p3d.viewer <model_dir>`) and give the link. Add 2–3 lines on how to use it (drag to rotate, wheel to zoom, hover a part to see its name, open the panel with the button at the top right to toggle what is shown, and use the direction labels to give instructions in chat). Use the button names as they appear in the viewer's language.
2. If there are points to confirm (`questions_for_user` from the review, things you were unsure about in the design), ask them with AskUserQuestion in the same message as the viewer (include part labels and directions). Do not put questions in the viewer.
3. Add the chat instructions and answers to `spec.md` as requirements and go back to step 2 or 3. If the user says OK, go to step 7.

## Export (step 7)

Follow the `export` skill (`cd RT && PY -m p3d.export <model_dir>` → write `print-notes.md` → share links to the 3MF/STL and print notes).
