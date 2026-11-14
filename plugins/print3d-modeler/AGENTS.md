# AGENTS.md (print3d-modeler)

Rules for `plugins/print3d-modeler/`. They add to the repository root `AGENTS.md`; read that first.

## What this plugin does

`print3d-modeler` lets Claude design a 3D model with the user through conversation and hand back files that print as is on an **FDM** printer (resin and other processes are out of scope).

Flow driven by the `model` skill: hearing → design (named parts, dimensions, print orientation) → Python model (`model.py`, build123d) → automatic measurements (`p3d.analyze`) → two read-only reviewer subagents in parallel (`printability-reviewer`, `requirements-reviewer`, at most 3 fix rounds) → user check in an offline 3D viewer → export of STL / 3MF in print orientation plus print notes.

```
skills/      model (entry), resume, view, review, export, printer, help    user-facing skills
             modeling-conventions, printability-rules                       internal rule books (user-invocable: false)
agents/      printability-reviewer, requirements-reviewer                  read-only, reply with JSON only
runtime/     setup_env.sh, requirements.txt                                 venv in $CLAUDE_PLUGIN_DATA or ~/.print3d-modeler
             p3d/ model.py (LabeledModel), analyze.py, measure.py, export.py, printer.py, layout.py, viewer.py, meshutil.py
             viewer/viewer_template.html + vendor/three-bundle.partNN.js    single-file offline viewer (three.js inlined)
```

Python 3.10+, build123d (modeling), trimesh (measurement, GLB/STL), manifold3d (booleans). `model.py` finds the runtime through `PYTHONPATH` (`PYTHONPATH=RT PY model.py`) and must not read environment variables: the Anthropic directory scan holds plugins whose code reads values from the user's environment.

## Fixed conventions

These are decided with the maintainer and are relied on by the skills, the reviewers, the viewer and the user. Do not change them in passing.

- **Coordinates:** millimeters, right-handed, **up = +Z (Z = 0 is the bed), front = −Y, right = +X**. Direction labels are written `"up (+Z)"`, `"front (-Y)"` and so on (`meshutil.DIRECTION_LABELS`).
- **Design pose vs print pose:** models are built and reported in the pose they are used in. The print orientation is stored separately as rotations about fixed X, then Y, then Z (`set_print_orientation`, `meshutil.rotation_matrix`) and applied only to `out/print/` and the final export. After it, `p3d.layout` may only turn a piece about Z and move it on the printer's plates; the group `matrix` in parts.json includes both.
- **Printer settings:** `printer.json` in the model folder, then `print3d/`, then the remembered printer (`printer.json` next to the runtime venv, written by `p3d.printer --save`), then defaults. Bambu Lab preset volumes follow bambulab.com spec pages; for two-nozzle printers `build_volume_mm` is the single-nozzle area.
- **FDM thresholds** default to a 0.4 mm nozzle and PLA: walls ≥ 2 × nozzle, details ≥ nozzle, overhang ≤ 45°, bridge ≤ 10 mm, fit clearance 0.2–0.4 mm, bed contact ≥ 50 mm². `printer.json` (model folder, then `print3d/`) overrides them.
- **Language:** plugin text is English. Labels, `key_dims` names and user-facing files are in the user's language. Identifiers stay English: part ids, file names, JSON keys, requirement IDs (`R1`…), severities, and the `## vN … step X` lines in `history.md`. The viewer UI supports `en` and `ja`.

## Code Review Rules

### Coordinate system and orientation

- Anything reported to the user or the reviewers (positions, `location`, `center`, `direction`, `facing`, part anchors) must be in design-pose coordinates with the fixed axes above. Flag code that reports print-pose coordinates, swaps the meaning of ±Y or ±X, treats +Y as front, or changes `DIRECTION_LABELS`.
- Flag changes to the rotation order or convention in `rotation_matrix` / `place_on_bed`, or code that rotates the design-pose files (`out/model.*`, `out/parts/`). Only `out/print/` and `out/final/` are in print pose, and every printed piece must end with its lowest point at Z = 0.

### Printability checks

- The thresholds and check names in `skills/printability-rules/SKILL.md` (`watertight`, `bodies`, `build_volume`, `bed_contact`, `wall_thickness`, `clearance`, `overhang`, `bridge`, `orientation`, `layout`) must match what `p3d/analyze.py` and `p3d/printer.py` actually use. Flag a change to one side only.
- Flag changes that make `analyze` stop reporting a real defect: lowering a severity (critical/major → warning) without a reason, widening a threshold beyond the printer settings, skipping a group or part, or swallowing an exception so a failed check reads as a pass. A FAIL verdict must stay "at least one critical or major finding".
- Thresholds must come from the resolved printer settings (`load_printer`), not from hard-coded numbers, so a user's `printer.json` (for example a 0.6 mm nozzle) takes effect.

### Contracts between files

Several files read each other's output. A change to one side without the other breaks the workflow silently.

- `parts.json` (written by `LabeledModel.build()`): fields used by `analyze.py`, `measure.py`, `export.py`, `viewer.py`, the viewer JS and both reviewers. Flag renamed or removed fields unless every reader and `skills/modeling-conventions/references/parts-schema.json` are updated in the same PR.
- `analysis.json` / `p3d.analyze --stdout`: findings carry `severity`, `issue`, `part`, `direction`, `evidence`, `suggestion`, `location`, `check`, plus `thresholds`. The printability reviewer and the skills read these keys.
- Reviewer output JSON (`agents/*.md`, "Output" section): keys `reviewer`, `iteration`, `verdict`, `findings[]` with `id`, `severity`, `part`, `direction`, `issue`, `evidence`, `suggestion`, `location`; the requirements reviewer also returns `requirements[]` (`id`, `status`, `evidence`) and `questions_for_user[]` (`id`, `part`, `text`, `options`). `skills/model/references/workflow.md` saves and acts on them, and the main agent passes `questions_for_user` straight to AskUserQuestion. Flag schema changes not mirrored in the workflow.
- `runtime/setup_env.sh` must print a JSON object with `python` and `runtime` on its **last** line; every skill parses it. Flag anything that prints after it on stdout, and changes that make the script non-idempotent or drop the Windows `Scripts/python.exe` path.
- CLI commands and flags documented in `skills/modeling-conventions/SKILL.md` (`p3d.analyze`, `p3d.measure --part/--section/--distance/--ray`, `p3d.viewer --lang`, `p3d.export`, `p3d.printer --presets/--find/--save`) and the `LabeledModel` API shown there must exist with those names. Flag renames that leave the docs or skills pointing at old names.
- `resume` reads the last `## vN … step X` line of `history.md`. Flag changes to how that line is written or parsed on only one side.

### Reviewer subagents

- `printability-reviewer` and `requirements-reviewer` are independent and read-only: `tools` stays `["Read", "Grep", "Glob", "Bash"]`, the prompt forbids writing files, and the final reply is only the JSON. Flag added write tools, instructions that let them edit `model.py` or other files, or prompts that hand them the conversation history (they must judge only from files and measurements).
- The fix loop in `workflow.md` is capped at 3 rounds, after which the user decides. Flag changes that remove the cap or let the main agent skip the reviews.

### Viewer

- `viewer.html` must open offline as a single file and also render inside a claude.ai artifact. Flag any CDN `<script src>`, `importmap`, `import()` of a URL, `fetch` of a remote resource, or `data:` URL module import. three.js is inlined from `runtime/viewer/vendor/three-bundle.partNN.js`: one unminified esbuild bundle split into parts under 256 KiB (the Anthropic directory holds files over 256 KiB and minified code). Rebuild them only with `.github/scripts/build_three_bundle.py`; flag a hand edit, a minified part, or a part of 256 KiB or more.
- Data embedded into the HTML must stay escaped: `viewer.py` replaces `</` in the model JSON and `</script` in the bundle. Flag removal of that escaping or new injection points that skip it, because part labels and descriptions are free text.
- Every UI string goes through the `P3D_I18N` table and must exist in both `en` and `ja`. Flag hard-coded UI text, or a key added to only one language.
- Turning the direction display off hides both the arrows and their labels; the 3D view is on the left and the side panel (closed by default) on the right. Flag changes that break these.

### Runtime code

- The runtime must not access the network at model-build or analysis time; only `setup_env.sh` installs from PyPI. Flag new network calls.
- JSON files are written with `encoding="utf-8"` and `ensure_ascii=False` so Japanese labels survive, and numpy values go through `np_default`. Flag writes that drop these.
- New Python dependencies go in `runtime/requirements.txt` (the stamp file there triggers reinstall). Flag imports of packages that are not listed.
