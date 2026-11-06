# print3d-modeler

English | [日本語](README.ja.md)

Tell Claude what you want to make with your 3D printer, and it designs the model with you through conversation in Python (build123d). After a 3D viewer check and independent reviews, it exports **3MF / STL files ready to print on an FDM 3D printer**.
Built for Cowork in the Claude desktop app (it also works in Claude Code).

## Install

```
/plugin marketplace add TomokiIshimine/ishimine-plugins
/plugin install print3d-modeler@ishimine-plugins
```

## Usage

| Example request | Skill | What it does |
|---|---|---|
| "I want to 3D print a phone stand" / `/print3d-modeler:model phone stand` | model | Entry point for a new model. Runs everything from hearing to final export |
| "Continue the model from earlier" / `/print3d-modeler:resume` | resume | Resumes an unfinished model from the step where it stopped |
| "Show it in 3D" / `/print3d-modeler:view` | view | Rebuilds and opens the 3D viewer |
| "Review it again" / `/print3d-modeler:review` | review | Reruns only the printability and requirements reviews |
| "Export the STL" / `/print3d-modeler:export` | export | Writes 3MF/STL in print orientation plus print notes |
| "My printer is an A1 mini" / `/print3d-modeler:printer` | printer | Sets build volume, nozzle size and material |

## How it works

1. **Hearing**: Claude asks multiple-choice questions about purpose, size, shape, how parts fit together, and your printer.
2. **Design**: The model is split into named parts (base, backrest, and so on); dimensions and print orientation are decided and confirmed with you.
3. **Build and run**: Claude writes the model in Python and fixes obvious failures using automatic measurements (watertightness, wall thickness, overhangs, build volume, and more).
4. **Review**: Two independent subagents check in parallel whether it can be printed and whether it meets your requirements. Up to 3 rounds of fixes.
5. **Your check**: You inspect the model in a 3D viewer. Rotate, zoom and pan freely; hovering a part shows its name (e.g. "P1 Base"). Toggle visibility or transparency per part, switch between use and print orientation, and show direction arrows, faces likely to need support, and a size reference. Then give instructions in chat using part names and directions (up/down, front/back, left/right).
6. **Export**: 3MF / STL placed in print orientation, plus print notes with recommended settings and whether supports are needed.

## Conventions

- Coordinates: **up = +Z (Z=0 is the bed), front = −Y, right = +X**, in millimeters. Directions refer to the model as used; print orientation is kept separately.
- FDM only. Default thresholds assume a 0.4 mm nozzle (walls ≥ 0.8 mm, overhangs up to 45°, bridges up to 10 mm, fit clearance 0.2–0.4 mm).
- Build volume can be set per printer (default 220×220×250 mm), with presets for popular models.

## Requirements

- Python 3.10 or later, and network access to PyPI (first run only).
  On first run it installs build123d, trimesh, manifold3d and others into a virtual environment (`$CLAUDE_PLUGIN_DATA` or `~/.print3d-modeler/venv`). This takes a few minutes.
- The viewer is a single HTML file with three.js embedded. It can be shown as an artifact, and works offline when opened in a browser.
- To update three.js, bundle `runtime/viewer/vendor/three-bundle.entry.js` with esbuild (`--bundle --minify --format=iife`) to regenerate `three-bundle.js`.

## Working folder

It creates `print3d/<model-name>/` under the folder you choose and keeps everything there: requirements (spec.md), design (design.md), code (model.py), viewer (viewer.html), review results, and final files (out/final/). If the session ends, `resume` picks up where you left off.

## Language

The plugin itself (skills, agents, templates, runtime messages) is written in English, but Claude talks to you in the language you write in.
Part names, the print notes and other files you read are written in that language too.
The 3D viewer UI is available in **English and Japanese**. Claude picks the one that matches your conversation when it builds the viewer (`LabeledModel(..., lang="en"|"ja")`, or `python -m p3d.viewer <dir> --lang en|ja`); if not set, it switches to Japanese when the part names are Japanese.

## Layout

```
print3d-modeler/
├── .claude-plugin/plugin.json
├── skills/            model, resume, view, review, export, printer (user-facing)
│                      printability-rules, modeling-conventions (internal rules and conventions)
├── agents/            printability-reviewer, requirements-reviewer (read-only reviewers)
└── runtime/           setup_env.sh, requirements.txt, p3d/ (Python library), viewer/ (template and three.js)
```

three.js (MIT License) is bundled in `runtime/viewer/vendor/`.
