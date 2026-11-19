# Print notes: <model name>

<!-- Write this file in the user's language (translate the headings too). -->

## Files
- 3MF: `out/final/<model>.3mf` (load it straight into your slicer; orientation is already set. With a Bambu Lab printer it is a Bambu Studio project holding every plate)
- STL: `out/final/<model>_<group>.stl`

## Filaments (multi-color models only; delete this section otherwise)
| No. | Color | Filament | Material | Weight upper bound |
|---|---|---|---|---|
| 1 | #F2F2F2 | Body (white) | PLA | … g |
| 2 | #1A1A1A | Letters (black) | not decided (choose in the slicer) | … g |

- The numbers are the filaments in the 3MF, not AMS slots: the slicer maps them to the loaded filaments when you send the job.
- Filament changes: about … (each change takes time and purges some filament)

## Print orientation
- <per piece: which face goes down>

## Print settings (<printer>, <0.4> mm nozzle, <PLA>, <bed type>)
<!-- From print_settings in the export JSON. With a Bambu Lab printer say that these are already set in the 3MF
     (process preset shown as modified; per-piece settings on the object). Otherwise the user sets them by hand. -->
| Setting | Value | Where it applies |
|---|---|---|
| Layer height | 0.2 mm (preset) | whole model |
| Walls (perimeters) | 3 | whole model |
| Infill | 25 % gyroid | whole model / <piece> |
| Supports | none / tree, from the bed only (where: …) | <piece> |
| Brim | auto (preset) / 5 mm outer (reason: small contact area) | <piece> |
| Bed | Textured PEI plate | — |

- Why: <reason, naming requirement IDs>

## Estimates
- Size: … mm / Volume: … cm³ / Weight upper bound (100% infill): … g

## Cautions (review warnings)
- 

## Assembly (multiple pieces)
- 
