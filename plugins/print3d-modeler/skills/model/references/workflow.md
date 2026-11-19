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
   - Colors only if the user brings them up (see "Colors" in `hearing.md`): which parts get which filament, named by color and material
2. Printer: before asking, run `cd RT && PY -m p3d.printer print3d` (the `print3d/` folder) and look at `source`.
   - A `printer.json` file (in `print3d/` or the remembered printer): use it and just mention it ("Printing on your Bambu Lab A1 mini (180×180×180 mm)"). Ask only if the user hints at another printer.
   - `"default"`: if your own memory has the user's printer, save it as the `printer` skill describes without asking. Otherwise ask for the printer model (offer the common Bambu Lab models: A1 mini / A1 / P1S·P2S / X1C, plus free text), then save it with `p3d.printer --save` (it is remembered for the next models). If the user does not know, go ahead with the defaults (220×220×250 mm, 0.4 mm nozzle, PLA) and mark them as provisional in spec.md.
3. Create `DIR/spec.md` from `templates/spec.md`. One requirement per line with IDs R1, R2… (**never renumber**; strike cancelled requirements through with ~~strikethrough~~ and keep them). Give dimensional requirements a number and a tolerance.

## Step 2. Design → design.md

1. Split the model into parts the user can easily point at ("base", "backrest", "handle"); one part = one solid. Small holes and grooves are not parts; label them as locations with `add_feature`.
2. For each part decide the id (lowercase slug), label (in the user's language), key dimensions and related requirement IDs.
3. Think of 1–2 candidate print orientations (a large flat face on the bed / little support / layers not split by the load direction).
4. Write the part table, dimensions, and print orientation with reasons in `DIR/design.md` (`templates/design.md`). For a multi-color model also fill in the filament table and make colored details separate parts (letters, stripes, inlays), added after the part they sit in.
5. Confirm the key points (how the parts are split, main dimensions, print orientation) with AskUserQuestion. If nothing is uncertain, one combined question is fine.

## Step 3. Implement → model.py

- Copy `templates/model_template.py` and fill it in. See `examples/phone_stand_model.py` for a simple sample and `examples/small_house_model.py` for a detailed one (printable details without supports).
- Put parameters (dimensions) as constants at the top of the file, with requirement IDs in comments.
- Set `lang` in `LabeledModel(...)` to the conversation language (`"ja"` or `"en"`).
- Overlap parts by 0.5–1 mm so they fuse reliably (the `EMBED` constant).
- Multi-color: `add_filament` for each color (color and material; material may be None), then `filament=` on each part. Add colored details after the part they sit in: where parts of different filaments overlap, the later part's filament prints (see "Filaments" in `modeling-conventions`). An inlay sunk into the surface keeps the surface flat; letters standing 0.6–1 mm proud are easy to see.
- Use separate `print_group`s for pieces printed separately. `build()` lays them out on the printer's bed (turning them about Z at any angle and packing their real outlines, i.e. the whole piece seen from above including overhangs, so concave pieces nest) and puts what does not fit onto further plates; keep each piece within the build volume, and if the user wants everything in one print run, size the pieces so they fit one plate together. Fit clearance is 0.2–0.4 mm per side (`clearance_mm` in printer.json).
- Horizontal holes (holes running sideways) need no support if the top is pointed at 45° (teardrop).
- A large flat bottom makes printing stable. Do not fillet the edges of the bottom face (causes warping and detaching).
- Slicer settings: after `set_print_orientation`, add `m.set_print_settings(...)` for what the model needs, following "Print settings" in `printability-rules`: walls and infill from the strength requirements, supports for the pieces with overhangs the shape cannot avoid, a brim for small or tall bases, a finer `layer_height` for small details. Use `group="<print_group>"` for one piece's own settings, and `reason=` (in the user's language, naming requirement IDs) for the print notes. Leave out what the slicer preset already does well. A Bambu Lab printer gets them in the 3MF project; other printers in the print notes.
- How to write build123d: `modeling-conventions/references/build123d-cheatsheet.md`.

## Step 4. Run and self-check

```bash
cd DIR && PYTHONPATH=RT PY model.py
```

- Look at `auto_check` and `critical_or_major` in the output JSON. **Fix obvious failures yourself and run again** (exceptions, not watertight, split bodies, exceeding the build volume) before going to step 5.
- A piece too big for the printer (`build_volume`, critical) needs a decision: another print orientation, splitting it into pieces that are assembled, or scaling it down. Tell the user plainly that it does not fit their printer, with the size and the build volume, and ask with AskUserQuestion which way to go unless one is obviously right.
- A `layout` warning means the pieces need more than one plate (print run). Tell the user how many and which pieces go together; it is fine if they accept it.
- `filaments` findings (multi-color): more filaments than the AMS feeds is major; a hidden part, a color thinner than 2 layers or the nozzle, or mixed base materials are warnings to fix or tell the user about.
- Check the settings with `cd RT && PY -m p3d.print_settings DIR`: fix its `warnings` (supports missing on a piece with overhang findings, a layer height out of range) or have a reason for them. After a run, set supports for pieces whose overhangs you keep.
- Check dimensions with `cd RT && PY -m p3d.measure DIR` (`--part id` `--section z=30` `--distance a b` `--ray x,y,z dx,dy,dz`).
- Aim for one run to take under 30 seconds. If it is slow, revisit fillets, text and fine repeated shapes.

## Step 5. Review

- Launch the three reviewers in parallel as described in "Launching the reviews" in SKILL.md.
- Save to `DIR/reviews/iter-N-printability.json`, `DIR/reviews/iter-N-requirements.json` and `DIR/reviews/iter-N-print-settings.json` (the returned JSON as is; if there is text around it, only the JSON part).
- Verdict: passes when `verdict` is PASS for all three. Put warnings and `print_notes` in `print-notes.md`.
- Print-settings findings are usually fixed with the `set_print_settings` call in their `suggestion` (or `bed_type` in printer.json); a shape change can also remove the need (a chamfer instead of supports, a wider base instead of a brim).
- Fixing FAILs: use `part`, `direction` and `suggestion` in each finding to fix model.py → step 4 → review again (N+1). Record what you changed in `history.md`.
- For findings still open after 3 rounds, let the user choose with AskUserQuestion, for example "A: fix it like this (impact …) / B: print as is (risk …) / C: change the requirement".

## Step 6. User check

### Checking in the viewer

- The viewer is kept to a viewing tool (rotate, zoom, pan, part names on hover, click a part to copy its name, show/hide per part or object, as used / print orientation, and toggles for directions, part labels, faces needing support, bed contact faces and a size-reference coin). It has no question cards, review findings or measurement lists.
- Multi-color models add a "part colors / filament colors" switch to the toolbar. It opens in part colors; filament colors paint each part in its filament's color, as it will print, with a legend of filament numbers, colors and materials. Mention it when you share the viewer.
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
- Review iter-4: printability PASS / requirements PASS / print settings PASS
```

Always write the leading `## vN … step X` line, in English, whatever the conversation language (resume reads the last one to decide where to pick up). The bullet lines below it can be in the user's language.
