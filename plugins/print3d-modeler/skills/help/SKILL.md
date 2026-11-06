---
name: help
description: >
  Use when the user asks how to use print3d-modeler: what it can do, which commands it has, how the workflow goes,
  or how to get started. Triggered by requests like "how do I use the 3D printing plugin", "what commands are there",
  "what can print3d-modeler do", "how do I start", or "/print3d-modeler:help". Answers only; it does not start modeling.
argument-hint: "[topic: a command name, viewer, workflow, printer, files, directions]"
metadata:
  version: "0.1.0"
---

# Help

Topic (optional): $ARGUMENTS

Explain how to use print3d-modeler. This skill only answers questions: do not run `setup_env.sh`, write files or start a model.

## Language

These instructions are in English, but **answer in the user's language**: the language of the topic they typed or, if they typed none, of the conversation so far. If there is nothing to go on (the first message is only `/print3d-modeler:help`), answer in the response language configured for Claude if you know it, otherwise in English. Keep command names (`/print3d-modeler:model`), skill names and file names as they are; translate everything else, including the example requests below.

## What to answer

**No topic** → a short overview that fits on one screen, in this order:

1. **What it is** (1–2 sentences): designs a model for an FDM 3D printer through conversation, checks it with automatic measurements, two independent reviews and a 3D viewer, and hands back print-ready 3MF / STL.
2. **Getting started**: just describe what to make ("I want to 3D print a phone stand", or `/print3d-modeler:model phone stand`). Mentioning the printer model and the size of the object it holds or fits saves questions. The first run spends a few minutes installing Python packages (Python 3.10+ and access to PyPI are needed once).
3. **Commands**: the table below.
4. **How a model is made**: the steps below, in one line each.
5. **Your models** (only if the check below finds anything).
6. **One next step**, matching the state: no models yet → "describe what you want to make"; an unfinished model → "say 'continue' or run `/print3d-modeler:resume <name>`".

**A topic** → answer only that topic, in more depth, and end with one next step. For details, read the matching file instead of relying on memory:

| Topic | Read |
|---|---|
| A command name (`model`, `resume`, `view`, `review`, `export`, `printer`) | `${CLAUDE_PLUGIN_ROOT}/skills/<name>/SKILL.md` |
| The viewer, how to point at parts and give changes | `${CLAUDE_PLUGIN_ROOT}/skills/view/SKILL.md` (step 5) |
| The workflow, reviews, the 3-round fix limit | `${CLAUDE_PLUGIN_ROOT}/skills/model/SKILL.md` |
| Printer, build volume, nozzle, material, presets | `${CLAUDE_PLUGIN_ROOT}/skills/printer/SKILL.md` |
| Directions, coordinates, part names, the working folder and its files | `${CLAUDE_PLUGIN_ROOT}/skills/modeling-conventions/SKILL.md` |
| What counts as printable, thresholds | `${CLAUDE_PLUGIN_ROOT}/skills/printability-rules/SKILL.md` |

If the topic is not about this plugin, say so in one line and answer the question normally.

Explain it for the user, not for Claude: leave out PY/RT, environment variables, JSON keys and internal steps unless they ask. Rephrase technical terms the first time (for example: "overhang (a part whose underside hangs in the air and needs support underneath)").

## Commands

| Command | Say it in words, for example | What it does |
|---|---|---|
| `/print3d-modeler:model [what to make]` | "I want to 3D print a phone stand" | Starts a new model and runs the whole flow, from questions to export |
| `/print3d-modeler:resume [model name]` | "Continue the model from earlier" | Picks up an unfinished model where it stopped |
| `/print3d-modeler:view [model name]` | "Show it in 3D" | Rebuilds and opens the 3D viewer |
| `/print3d-modeler:review [model name]` | "Check whether it can be printed" | Reruns only the two independent reviews |
| `/print3d-modeler:export [model name]` | "Give me the files to print" | Writes 3MF / STL in print orientation, plus print notes |
| `/print3d-modeler:printer [printer or X×Y×Z]` | "My printer is an A1 mini" | Sets the build volume, nozzle size and material |
| `/print3d-modeler:help [topic]` | "How do I use this?" | This help |

Commands are optional: asking in plain words works the same. Without a model name, `view`, `review` and `export` use the most recently updated model.

## How a model is made

1. **Questions**: purpose, size, shape, how parts fit or move, and your printer. Answers become numbered requirements (R1, R2…).
2. **Design**: the model is split into named parts ("Base", "Backrest") with dimensions and a print orientation; you confirm the key points.
3. **Build**: Claude writes the model in Python and fixes obvious problems found by automatic measurements (wall thickness, overhangs, bed contact, build volume…).
4. **Review**: two independent reviewers check "will it print?" and "does it meet the requirements?"; Claude fixes what they find, up to 3 rounds, before showing you.
5. **Your check**: a 3D viewer opens. Hover a part to see its name (P1, P2…), then ask for changes in chat with part names and directions: "make P2 Backrest 10 mm taller". Steps 2–5 repeat until you are happy.
6. **Export**: 3MF / STL already placed in print orientation, and print notes (supports, brim, recommended settings). The 3MF opens directly in Bambu Studio, PrusaSlicer, OrcaSlicer or Cura.

Good to know (mention when relevant, not all at once):

- Directions always mean the model **as used**: up = away from the bed, front = the side you look at, left/right as seen from the front. The print orientation is handled separately.
- Everything is saved in `print3d/<model name>/` in the folder you work in, so you can stop at any time and continue later.
- FDM printers only. Defaults: 220×220×250 mm build volume, 0.4 mm nozzle, PLA. Set your own with `printer`.

## Your models (light check)

Before answering the overview, look for existing work with Glob only (no Python, no setup): `print3d/*/spec.md` and `print3d/printer.json` under the folder the user picked (or the current working folder).

- For each model found (newest first, at most 4): the folder name and the title in `spec.md`, and how far it got. Read only the last `## vN … step X` line of `history.md` (the step it ends on) and whether `out/final/` exists. Say "finished" if `out/final/` exists, otherwise name the step in words. `history.md` uses the `model` skill's numbering, which differs from the six steps above: 1 questions, 2 design, 3 writing the model, 4 build and self-check, 5 review, 6 your check in the viewer, 7 export. Do not show the step number itself.
- Printer: the `preset` or `name` and build volume in `printer.json`, or "not set (defaults are used)".
- If nothing is found, skip this section without comment.
