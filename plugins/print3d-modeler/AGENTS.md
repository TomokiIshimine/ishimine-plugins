# AGENTS.md (print3d-modeler)

Rules for `plugins/print3d-modeler/`. They add to the repository root `AGENTS.md`; read that first.

## What this plugin does

`print3d-modeler` lets Claude design a 3D model with the user through conversation and hand back files that print as is on an **FDM** printer (resin and other processes are out of scope).

Flow driven by the `model` skill: hearing → design (named parts, dimensions, print orientation) → Python model (`model.py`, build123d) → automatic measurements (`p3d.analyze`) → three read-only reviewer subagents in parallel (`printability-reviewer`, `requirements-reviewer`, `print-settings-reviewer`, at most 3 fix rounds) → user check in an offline 3D viewer → export of STL / 3MF in print orientation plus print notes.

```
skills/      model (entry), resume, view, review, export, printer, help    user-facing skills
             modeling-conventions, printability-rules                       internal rule books (user-invocable: false)
agents/      printability-reviewer, requirements-reviewer,                 read-only, reply with JSON only
             print-settings-reviewer
runtime/     setup_env.sh, requirements.txt                                 venv in $CLAUDE_PLUGIN_DATA or ~/.print3d-modeler
             p3d/ model.py (LabeledModel), analyze.py, measure.py, export.py, printer.py, layout.py, bambu.py, bambu_filaments.py,
                  filament.py, print_settings.py, check3mf.py, viewer.py, meshutil.py
             viewer/viewer_template.html + vendor/three-bundle.partNN.js    single-file offline viewer (three.js inlined)
```

Python 3.10+, build123d (modeling), trimesh (measurement, GLB/STL), manifold3d (booleans). `model.py` finds the runtime through `PYTHONPATH` (`PYTHONPATH=RT PY model.py`) and must not read environment variables: the Anthropic directory scan holds plugins whose code reads values from the user's environment.

## Fixed conventions

These are decided with the maintainer and are relied on by the skills, the reviewers, the viewer and the user. Do not change them in passing.

- **Coordinates:** millimeters, right-handed, **up = +Z (Z = 0 is the bed), front = −Y, right = +X**. Direction labels are written `"up (+Z)"`, `"front (-Y)"` and so on (`meshutil.DIRECTION_LABELS`).
- **Design pose vs print pose:** models are built and reported in the pose they are used in. The print orientation is stored separately as rotations about fixed X, then Y, then Z (`set_print_orientation`, `meshutil.rotation_matrix`) and applied only to `out/print/` and the final export. After it, `p3d.layout` may only turn a piece about Z and move it on the printer's plates; the group `matrix` in parts.json includes both.
- **Printer settings:** `printer.json` in the model folder, then `print3d/`, then the remembered printer (`printer.json` next to the runtime venv, written by `p3d.printer --save`), then defaults. Bambu Lab preset volumes follow bambulab.com spec pages; for two-nozzle printers `build_volume_mm` is the single-nozzle area.
- **Bambu Studio projects:** for Bambu Lab presets, `p3d.export` writes `out/final/<model>.3mf` as a Bambu Studio project (`p3d/bambu.py`): Application metadata `BambuStudio-…`, `Metadata/model_settings.config` with one `<plate>` per plate, `Metadata/project_settings.config` naming system presets only, and each build item at its plate's origin on Bambu Studio's plate grid (stride 1.2 × the bed, `ceil(sqrt(n))` columns). Bambu Studio drops the plates of any 3MF without these. Preset names and beds in `bambu.PRINTERS` follow `resources/profiles/BBL` of the BambuStudio repository; a preset added to `printer.PRESETS` for a Bambu Lab printer needs a row there too (and in `bambu_filaments.FILAMENT_PRESETS`).
- **Multi-color:** filaments are named by color and material (`add_filament`), never by AMS slot, and a material may stay undecided until export (`p3d.export --material`). Only models whose parts use two or more filaments take the multi-color path; with none or one, every output (parts.json aside from the empty `filaments` / `filament` fields, 3MF, STL, viewer) must stay as it was for one-color models. Where parts of different filaments overlap, the later part wins (`filament.resolve_overlaps`), and the viewer draws filament colors with the same rule. In a Bambu Studio project each piece is one object with one `<part>` per filament carrying its `extruder` (1-based), and `project_settings.config` lists the project's filaments.
- **Print settings:** slicer settings are named in plain words with `set_print_settings` (whole model or one print_group; `layer_height` whole model only), kept in parts.json `print_settings`, and mapped to Bambu Studio keys only in `p3d/print_settings.py`. A model-wide `layer_height` replaces printer.json `layer_height_mm` in `p3d.analyze` and `p3d.export` (`with_layer_height`), so layer counts match what prints. In a Bambu Studio project, model-wide values go into `project_settings.config` with their keys listed in `different_settings_to_system[0]` (Bambu Studio resets every unlisted key to the system preset), a piece's own values go on its `<object>` in `model_settings.config`, and `curr_bed_type` is always written for Bambu Lab printers (printer.json `bed_type`, default `textured_pei`; without it Bambu Studio opens on the Cool Plate). Values are strings checked against what Bambu Studio accepts: one wrong value makes it drop the project's settings. A model without settings changes only by the `curr_bed_type` line.
- **3MF format check:** `p3d/check3mf.py` checks every 3MF `p3d.export` writes (`format_check` in its JSON) and is written independently of the writers. A rule added to a writer (a new key, file or count) needs the matching check there, and the smoke test keeps one broken-file case per rule family.
- **FDM thresholds** default to a 0.4 mm nozzle and PLA: walls ≥ 2 × nozzle, details ≥ nozzle, overhang ≤ 45°, bridge ≤ 10 mm, fit clearance 0.2–0.4 mm, bed contact ≥ 50 mm². `printer.json` (model folder, then `print3d/`) overrides them.
- **Language:** plugin text is English. Labels, `key_dims` names and user-facing files are in the user's language. Identifiers stay English: part ids, file names, JSON keys, requirement IDs (`R1`…), severities, and the `## vN … step X` lines in `history.md`. The viewer UI supports `en` and `ja`.

## Code Review Rules

### Coordinate system and orientation

- Anything reported to the user or the reviewers (positions, `location`, `center`, `direction`, `facing`, part anchors) must be in design-pose coordinates with the fixed axes above. Flag code that reports print-pose coordinates, swaps the meaning of ±Y or ±X, treats +Y as front, or changes `DIRECTION_LABELS`.
- Flag changes to the rotation order or convention in `rotation_matrix` / `place_on_bed`, or code that rotates the design-pose files (`out/model.*`, `out/parts/`). Only `out/print/` and `out/final/` are in print pose, and every printed piece must end with its lowest point at Z = 0.

### Printability checks

- The thresholds and check names in `skills/printability-rules/SKILL.md` (`watertight`, `bodies`, `build_volume`, `bed_contact`, `wall_thickness`, `clearance`, `overhang`, `bridge`, `orientation`, `layout`, `filaments`) must match what `p3d/analyze.py` and `p3d/printer.py` actually use. Flag a change to one side only.
- Flag changes that make `analyze` stop reporting a real defect: lowering a severity (critical/major → warning) without a reason, widening a threshold beyond the printer settings, skipping a group or part, or swallowing an exception so a failed check reads as a pass. A FAIL verdict must stay "at least one critical or major finding".
- Thresholds must come from the resolved printer settings (`load_printer`), not from hard-coded numbers, so a user's `printer.json` (for example a 0.6 mm nozzle) takes effect.

### Contracts between files

Several files read each other's output. A change to one side without the other breaks the workflow silently.

- `parts.json` (written by `LabeledModel.build()`): fields used by `analyze.py`, `measure.py`, `export.py`, `viewer.py`, the viewer JS, `print_settings.py` and the three reviewers. Flag renamed or removed fields unless every reader and `skills/modeling-conventions/references/parts-schema.json` are updated in the same PR.
- `analysis.json` / `p3d.analyze --stdout`: findings carry `severity`, `issue`, `part`, `direction`, `evidence`, `suggestion`, `location`, `check`, plus `thresholds`. The printability reviewer and the skills read these keys.
- Reviewer output JSON (`agents/*.md`, "Output" section): keys `reviewer`, `iteration`, `verdict`, `findings[]` with `id`, `severity`, `part`, `direction`, `issue`, `evidence`, `suggestion`, `location`; the requirements reviewer also returns `requirements[]` (`id`, `status`, `evidence`) and `questions_for_user[]` (`id`, `part`, `text`, `options`); the print-settings reviewer (`reviewer: "print_settings"`) adds `group` and `requirement` to each finding and returns `print_notes[]` and `excluded[]`. `skills/model/references/workflow.md` saves and acts on them, and the main agent passes `questions_for_user` straight to AskUserQuestion. Flag schema changes not mirrored in the workflow.
- `runtime/setup_env.sh` must print a JSON object with `python` and `runtime` on its **last** line; every skill parses it. Flag anything that prints after it on stdout, and changes that make the script non-idempotent or drop the Windows `Scripts/python.exe` path.
- CLI commands and flags documented in `skills/modeling-conventions/SKILL.md` (`p3d.analyze`, `p3d.measure --part/--section/--distance/--ray`, `p3d.viewer --lang`, `p3d.export`, `p3d.print_settings`, `p3d.check3mf`, `p3d.printer --presets/--find/--save/--bed-type`) and the `LabeledModel` API shown there must exist with those names. Flag renames that leave the docs or skills pointing at old names.
- `resume` reads the last `## vN … step X` line of `history.md`. Flag changes to how that line is written or parsed on only one side.

### Reviewer subagents

- `printability-reviewer`, `requirements-reviewer` and `print-settings-reviewer` are independent and read-only: `tools` stays `["Read", "Grep", "Glob", "Bash"]`, the prompt forbids writing files, and the final reply is only the JSON. Flag added write tools, instructions that let them edit `model.py` or other files, or prompts that hand them the conversation history (they must judge only from files and measurements).
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
