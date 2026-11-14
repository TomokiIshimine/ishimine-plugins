---
name: printability-rules
description: >
  Criteria for whether a model can be printed on an FDM 3D printer, and how to read the automatic measurements (p3d.analyze).
  Refer to it when reviewing printability, or when you need threshold values for wall thickness, overhangs, bridges,
  bed contact, build volume or fit clearance.
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
| Fits the build volume | Within the printer's `build_volume_mm`, turned about Z at any angle (the layout turns it 90° or diagonally when needed) | critical | `build_volume` |
| Has a flat face on the bed | Contact area > 0 | critical | `bed_contact` |
| Stable on the bed | Contact area ≥ 50 mm² and center of mass inside the contact area | major | `bed_contact` |
| Minimum wall thickness | Nozzle × 2 (0.8 mm) or more | major | `wall_thickness` |
| Smallest detail (pins, text strokes) | Nozzle size (0.4 mm) or more | major (reported with wall thickness) | `wall_thickness` |
| Fit clearance | 0.2–0.4 mm per side, no overlap (interference) | major | `clearance` |
| Overhang | Within 45° of vertical. Steeper faces need support | warning | `overhang` |
| Bridge | Downward horizontal faces with a short side of 10 mm or less print without support | warning (when exceeded) | `bridge` |
| Print orientation | Suggest another orientation if it clearly needs less support | warning | `orientation` |
| Layout on the plates | All pieces fit one plate together (`part_spacing_mm` apart); otherwise the number of plates (print runs) is reported | warning | `layout` |
| Layout made for this printer | parts.json `print_layout.bed_mm` equals the current `build_volume_mm` (otherwise rerun model.py) | major | `layout` |
| Piece turned diagonally to fit | Reported for the print notes | info | `layout` |

**Verdict:** FAIL if there is even one critical or major finding. PASS if there are only warnings (warnings go into the print notes).

## Reading the measurements, and caveats

- Positions (`location`, `center`) are design-pose coordinates; `facing` / `direction` are design-pose direction labels (`"up (+Z)"` and so on).
- Entries in `overhang_regions` with `flat: true` and `bridge_span_mm ≤ max_bridge_mm` are expected to print as bridges (they are listed in `bridges`). But **a cantilevered horizontal face (supported on one side only) is not a bridge**. Look at the shape; if it is cantilevered, treat it as an overhang.
- Wall thickness is measured by casting rays inward from random surface points. Near sharp corners it can read thinner than it is. Check the `location` with `p3d.measure --ray` or `--section`; if it is a corner false positive you may exclude it (state why in the evidence).
- Overhangs are judged on the fused shape, and faces with "another face within 0.3 mm directly below" or "the point just below the face inside another part" are already excluded as supported (for example the underside of a front lip sitting on the base).
- `layout` in analysis.json gives the plate count and, per piece, `plate`, `bed_turn_deg` and `bed_fit` (`fits`, `diagonal` or `too_big`).
- Bed contact area is the total of downward flat faces at Z ≤ 0.2 mm. If the bottom floats even slightly (no face at Z=0), it is 0.
- Things the measurements cannot catch (check by looking at the code and shape):
  - The top of horizontal holes (teardrop shaped? support needed above Ø8 mm)
  - Size of text and engravings (height 5 mm, stroke 0.8 mm, depth 0.6 mm or more)
  - Layer direction vs. load direction (layers crack easily under tension or bending across them → suggest an orientation)
  - Rounded edges on the bottom face (warping, detaching), and whether elephant's foot (first-layer spread) affects fitting parts
  - Long thin columns and tall thin plates (wobble and fail while printing; warn when height / thickness > 10)

## How to write findings

- `part` is the id in parts.json; `direction` is a direction label such as `"up (+Z)"`. Write `issue` in words that can be shown to the user, in the language spec.md is written in.
- `evidence` holds the measured value and its source (e.g. `analyze: min_wall=0.61mm @ (12.0, 4.5, 30.2)`).
- `suggestion` is a concrete fix with numbers. Say so if the fix affects what the user asked for.
