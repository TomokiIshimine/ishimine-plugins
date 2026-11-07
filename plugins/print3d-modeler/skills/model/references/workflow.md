# Detailed steps

PY = `python` printed by setup_env.sh, RT = `runtime`, DIR = the model's working folder (absolute path).
Write everything the user reads in the user's language (see "Language" in SKILL.md).

---

## Step 1. Hearing → spec.md / printer.json

1. Sort out what the first message already tells you and ask only about the gaps (sample questions in `hearing.md`). Always cover these five:
   - Purpose (what, where, how it is used; if it holds, slots into or hooks onto something, that object's dimensions)
   - Size (overall size, or real measurements of the mating object; ask the user to measure specific spots)
   - Shape (required shapes, holes, grooves, text; look and feel)
   - Movement and assembly (lids, fits, hinges, screws; printed separately and assembled?)
   - Printing setup (printer model → build volume, nozzle size, material)
2. Once you know the printer model, write `print3d/printer.json` (see the `printer` skill). If unknown, go ahead with the defaults (220×220×250 mm, 0.4 mm nozzle, PLA) and mark them as provisional in spec.md.
3. Create `DIR/spec.md` from `templates/spec.md`. One requirement per line with IDs R1, R2… (**never renumber**; strike cancelled requirements through with ~~strikethrough~~ and keep them). Give dimensional requirements a number and a tolerance.

## Step 2. Design → design.md

1. Split the model into parts the user can easily point at ("base", "backrest", "handle"); one part = one solid. Small holes and grooves are not parts; label them as locations with `add_feature`.
2. For each part decide the id (lowercase slug), label (in the user's language), key dimensions and related requirement IDs.
3. Think of 1–2 candidate print orientations (a large flat face on the bed / little support / layers not split by the load direction).
4. Write the part table, dimensions, and print orientation with reasons in `DIR/design.md` (`templates/design.md`).
5. Confirm the key points (how the parts are split, main dimensions, print orientation) with AskUserQuestion. If nothing is uncertain, one combined question is fine.

## Step 3. Implement → model.py

- Copy `templates/model_template.py` and fill it in. See `examples/phone_stand_model.py` for a simple sample and `examples/small_house_model.py` for a detailed one (printable details without supports).
- Put parameters (dimensions) as constants at the top of the file, with requirement IDs in comments.
- Set `lang` in `LabeledModel(...)` to the conversation language (`"ja"` or `"en"`).
- Overlap parts by 0.5–1 mm so they fuse reliably (the `EMBED` constant).
- Use separate `print_group`s for pieces printed separately. Fit clearance is 0.2–0.4 mm per side (`clearance_mm` in printer.json).
- Horizontal holes (holes running sideways) need no support if the top is pointed at 45° (teardrop).
- A large flat bottom makes printing stable. Do not fillet the edges of the bottom face (causes warping and detaching).
- How to write build123d: `modeling-conventions/references/build123d-cheatsheet.md`.

## Step 4. Run and self-check

```bash
cd DIR && PYTHONPATH=RT PY model.py
```

- Look at `auto_check` and `critical_or_major` in the output JSON. **Fix obvious failures yourself and run again** (exceptions, not watertight, split bodies, exceeding the build volume) before going to step 5.
- Check dimensions with `cd RT && PY -m p3d.measure DIR` (`--part id` `--section z=30` `--distance a b` `--ray x,y,z dx,dy,dz`).
- Aim for one run to take under 30 seconds. If it is slow, revisit fillets, text and fine repeated shapes.

## Step 5. Review

- Launch the two reviewers in parallel as described in "Launching the reviews" in SKILL.md.
- Save to `DIR/reviews/iter-N-printability.json` and `DIR/reviews/iter-N-requirements.json` (the returned JSON as is; if there is text around it, only the JSON part).
- Verdict: passes when `verdict` is PASS for both. Put warnings in `print-notes.md`.
- Fixing FAILs: use `part`, `direction` and `suggestion` in each finding to fix model.py → step 4 → review again (N+1). Record what you changed in `history.md`.
- For findings still open after 3 rounds, let the user choose with AskUserQuestion, for example "A: fix it like this (impact …) / B: print as is (risk …) / C: change the requirement".

## Step 6. User check

### Checking in the viewer

- The viewer is kept to a viewing tool (rotate, zoom, pan, part names on hover, show/hide per part or object, as used / print orientation, and toggles for directions, part labels, faces needing support, bed contact faces and a size-reference coin). It has no question cards, review findings or measurement lists.
- Its UI language follows `lang` (English or Japanese). Make sure it matches the conversation; if not, fix `lang` in model.py, or run `cd RT && PY -m p3d.viewer DIR --lang <en|ja>`.
- Ask the points you want to confirm (`questions_for_user` from the review, design choices you were unsure about, the choice of print orientation, and so on) with AskUserQuestion in the same message as the viewer. 1–3 at a time, with part labels (`P2 Backrest`) and directions.
- When making several objects (pieces printed separately), use separate `print_group`s and name them with `m.set_object_label("lid", "Lid")`. The viewer's part list then nests checkboxes per object.

### Taking instructions

- Treat instructions in chat (for example "make the handle 5 mm longer upward") the same way. Map the part label and direction to parts.json and the direction convention, add the instruction to "User feedback history" in `spec.md`, and add or update a requirement (R number).
- If the feedback needs the design rethought, go back to step 2; if it only changes dimensions, go back to step 3. Either way, pass the step 5 review before showing it again.

## Step 7. Export

Follow the `export` skill.

---

## How to write history.md

```markdown
## v3 (2026-11-04 15:20) step 6 → step 3
- User feedback: make the backrest 20 mm taller (R2 changed from 100 to 120 mm)
- model.py: BACK_H 100→120
- Review iter-4: printability PASS / requirements PASS
```

Always write the leading `## vN … step X` line, in English, whatever the conversation language (resume reads the last one to decide where to pick up). The bullet lines below it can be in the user's language.
