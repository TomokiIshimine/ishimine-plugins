---
name: printability-rules
description: >
  Criteria for whether a model can be printed on an FDM 3D printer, and how to read the automatic measurements (p3d.analyze).
  Refer to it when reviewing printability, or when you need threshold values for wall thickness, overhangs, bridges,
  bed contact, build volume or fit clearance, or when choosing or reviewing slicer settings (supports, brim, walls,
  infill, layer height, bed type).
user-invocable: false
metadata:
  version: "0.1.0"
---

# Printability criteria (FDM)

Defaults assume a 0.4 mm nozzle and PLA. Values in `printer.json` (or the print environment in spec.md) take priority.
Every number appears in `thresholds` in the `p3d.analyze` output; treat that as authoritative.

## Checks

| Check | Criterion (default) | Severity | analyze check name |
|---|---|---|---|
| Mesh is closed (watertight, manifold) | No holes, flipped faces or self-intersections | critical | `watertight` |
| A piece printed in one go is a single connected body | `bodies == 1` (per group) | critical | `bodies` |
| Fits the build volume | Within the printer's `build_volume_mm`, turned about Z at any angle (the layout turns pieces about Z at any angle to pack them) | critical | `build_volume` |
| Has a flat face on the bed | Contact area > 0 | critical | `bed_contact` |
| Stable on the bed | Contact area ≥ 50 mm² and center of mass inside the contact area | major | `bed_contact` |
| Minimum wall thickness | Nozzle × 2 (0.8 mm) or more | major | `wall_thickness` |
| Smallest detail (pins, text strokes) | Nozzle size (0.4 mm) or more | major (reported with wall thickness) | `wall_thickness` |
| Fit clearance | 0.2–0.4 mm per side, no overlap (interference) | major | `clearance` |
| Overhang | Within 45° of vertical. Steeper faces need support | warning | `overhang` |
| Bridge | Downward horizontal faces with a short side of 10 mm or less print without support | warning (when exceeded) | `bridge` |
| Print orientation | Suggest another orientation if it clearly needs less support | warning | `orientation` |
| Layout on the plates | All pieces fit one plate together (`part_spacing_mm` apart); otherwise the number of plates (print runs) is reported | warning | `layout` |
| Layout made for this printer | parts.json `print_layout.bed_mm`, `spacing_mm` and `exclude_mm` equal the current `build_volume_mm`, `part_spacing_mm` and `bed_exclude_mm` (otherwise rerun model.py) | major | `layout` |
| Piece turned diagonally to fit | Reported for the print notes | info | `layout` |
| Crowded plate | Pieces keep 15 mm from the bed's edges, narrowed to 10 / 5 / 0 mm only when that saves a plate; under 10 mm is reported (cooler bed edge, little room for a brim) | info | `layout` |
| Filament count (multi-color) | No more filaments than the AMS feeds: 4 on the A1 / A1 mini (AMS lite), 16 on other Bambu Lab printers (four AMS units); more than 4 needs a second AMS unit | major (over the limit) / warning (more than 4) | `filaments` |
| Every part's color prints (multi-color) | A part entirely covered by later parts of other filaments never prints in its color | warning | `filaments` |
| Color regions are thick enough (multi-color) | Each color region at least 2 layers thick in the print direction, and color details (letters, lines) at least the nozzle size wide | warning | `filaments` |
| One base material per piece (multi-color) | Different base materials (such as PLA and PETG) in one piece bond poorly | warning | `filaments` |
| Filament changes (multi-color) | Rough count of filament changes per plate (layers holding two or more filaments) | info | `filaments` |

**Verdict:** FAIL if there is even one critical or major finding. PASS if there are only warnings (warnings go into the print notes).

## Reading the measurements, and caveats

- Positions (`location`, `center`) are design-pose coordinates; `facing` / `direction` are design-pose direction labels (`"up (+Z)"` and so on).
- Entries in `overhang_regions` with `flat: true` and `bridge_span_mm ≤ max_bridge_mm` are expected to print as bridges (they are listed in `bridges`). But **a cantilevered horizontal face (supported on one side only) is not a bridge**. Look at the shape; if it is cantilevered, treat it as an overhang.
- Wall thickness is measured by casting rays inward from random surface points. Near sharp corners it can read thinner than it is. Check the `location` with `p3d.measure --ray` or `--section`; if it is a corner false positive you may exclude it (state why in the evidence).
- Overhangs are judged on the fused shape, and faces with "another face within 0.3 mm directly below" or "the point just below the face inside another part" are already excluded as supported (for example the underside of a front lip sitting on the base).
- `filaments` in analysis.json (multi-color models only) lists each filament with its pieces and volume, and per plate `multi_filament_layers` and `estimated_changes` (a rough count from the layers each color spans: every change costs time and purged filament, so colors kept to few layers print faster and waste less).
- `layout` in analysis.json gives the plate count, `edge_margin_mm` (how far the pieces keep from the bed's edges), `exclude_mm` (areas of the bed the printer keeps free, never covered) and, per piece, `plate`, `bed_turn_deg` and `bed_fit` (`fits`, `diagonal` or `too_big`).
- Bed contact area is the total of downward flat faces at Z ≤ 0.2 mm. If the bottom floats even slightly (no face at Z=0), it is 0.
- Things the measurements cannot catch (check by looking at the code and shape):
  - The top of horizontal holes (teardrop shaped? support needed above Ø8 mm)
  - Size of text and engravings (height 5 mm, stroke 0.8 mm, depth 0.6 mm or more)
  - Layer direction vs. load direction (layers crack easily under tension or bending across them → suggest an orientation)
  - Rounded edges on the bottom face (warping, detaching), and whether elephant's foot (first-layer spread) affects fitting parts
  - Long thin columns and tall thin plates (wobble and fail while printing; warn when height / thickness > 10)

## Print settings (set_print_settings)

Slicer settings the model needs are chosen by the main agent in model.py (`m.set_print_settings(...)`, whole model or
one piece) and reviewed by `print-settings-reviewer`. `python -m p3d.print_settings <model_dir>` shows them with what
each piece ends up with (`pieces[g].settings`) and the analysis facts that bear on them; `p3d.export` writes them
into the Bambu Studio project and puts the same object in its output. Anything not set stays as the slicer's preset
has it: Bambu Lab process presets print with 2 walls, 15 % grid infill, no supports and an automatic brim, at 0.2 mm
layers for a 0.4 mm nozzle. Other printers get the settings in the print notes only (a plain 3MF has no place for
them). These are guidelines, not analyze checks; the reviewer reports them with the severities below.

| Setting | Guideline | When it is wrong |
|---|---|---|
| Supports (`supports`: none / normal / tree) | Needed on a piece with `overhang` or `bridge` findings, unless the shape shows they print anyway (a short cantilever, a teardrop hole). Tree for scattered or curved overhangs and small contact spots (easier to remove, fewer marks); normal for large flat overhangs. Not needed on a piece with no such findings | major: supports needed but none, with no reason in `reason` or the design; warning: supports on a piece that needs none, or the less suitable type |
| Supports from the bed only (`supports_from_bed_only`) | True when supports would otherwise stand on a visible or functional surface of the piece and the overhangs above the bed are the ones that need them | warning |
| Brim (`brim`: auto / none / outer / ears, `brim_width`) | A brim (outer, 5 mm, or ears for sharp corners) when `bed_contact_area_mm2` is small for the height (height / smallest base side > 3, or contact under 2 × `min_bed_contact_mm2`), and for ABS / ASA pieces with long straight edges. None when the bottom face must stay clean and contact is ample | major: a piece that the analysis says is unstable on the bed (`bed_contact` major) prints without a brim and without a fix in the shape; warning otherwise |
| Walls (`walls`) and top / bottom layers | 2 walls for decoration, 3–4 for parts that carry load, snap, are screwed or must be watertight; 4–5 top layers on large flat tops so they close. Walls × nozzle should not exceed half the thinnest wall that must be hollow inside (more walls just fill it solid, which is fine) | major: a spec.md requirement about strength, load or water-tightness is left at the 2-wall default; warning otherwise |
| Infill (`infill`, `infill_pattern`) | 10–15 % for decoration and light parts, 20–30 % for everyday parts, 40 % or more for load-bearing parts, 100 % only for small pins and clips. Gyroid or cubic for strength in all directions, grid for speed, lightning only for parts that carry no load | major: clearly too low for a load requirement in spec.md (for example 15 % on a hook or bracket that must hold weight); warning otherwise |
| Layer height (`layer_height`, whole model) | 25–75 % of the nozzle (0.1–0.3 mm on 0.4 mm). Finer (0.12–0.16 mm) for small text, smooth curves and fine detail; the preset's 0.2 mm otherwise. `p3d.print_settings` warns outside the range | major: outside the range; warning: details smaller than about 3 layers in height |
| Bed type (printer.json `bed_type`) | The plate the user has. Bambu Lab printers default to `textured_pei`. PETG on `smooth_pei` sticks too hard (use glue or textured); ABS / ASA like textured or engineering plates | warning |

The reason for the settings (`reason`, in the user's language) goes into the print notes. A setting chosen because of
a requirement names it (for example "R3: holds 2 kg, so 4 walls and 40 % gyroid infill").

## How to write findings

- `part` is the id in parts.json; `direction` is a direction label such as `"up (+Z)"`. Write `issue` in words that can be shown to the user, in the language spec.md is written in.
- `evidence` holds the measured value and its source (e.g. `analyze: min_wall=0.61mm @ (12.0, 4.5, 30.2)`).
- `suggestion` is a concrete fix with numbers. Say so if the fix affects what the user asked for.
