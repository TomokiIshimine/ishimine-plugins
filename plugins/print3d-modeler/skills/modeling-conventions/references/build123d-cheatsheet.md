# build123d cheat sheet (algebra mode, for FDM)

Assumes `from build123d import *`. Units are mm. Tested with build123d 0.13.

## Basic shapes and placement

```python
MIN = (Align.CENTER, Align.CENTER, Align.MIN)        # centered in XY, bottom at Z=0
b = Box(80, 60, 10, align=MIN)                        # width (X) × depth (Y) × height (Z)
c = Cylinder(radius=5, height=20, align=MIN)
s = Sphere(10); k = Cone(10, 5, 20); t = Torus(20, 3)
p = Pos(0, -20, 10) * Rot(-20, 0, 0) * b              # applied right to left: rotate, then move
```

- `Rot(x, y, z)` is in degrees (right-handed). `Rot(-20, 0, 0)` tilts the top of an upright plate backward (+Y); `Rot(20, 0, 0)` tilts it forward (−Y). `Rot(0, 20, 0)` tilts the top to the right (+X).
- When in doubt, print `min` / `max` of `p.bounding_box()` to check.

## Booleans

```python
body = b - Pos(0, 0, 2) * Box(76, 56, 20, align=MIN)  # hollow out
u = a + b                                            # union
i = a & b                                            # intersection
holes = [loc * Cylinder(1.7, 30) for loc in GridLocations(20, 20, 2, 2)]
for h in holes: body = body - h
ring = [loc * Cylinder(2, 5) for loc in PolarLocations(15, 6)]   # 6 around a circle
```

## Sketch → extrude, revolve, loft

```python
plate = extrude(RectangleRounded(40, 20, 4), amount=3)          # plate with rounded corners
tri = Polygon((0, 0), (40, 0), (0, 30), align=None)              # polygon from points (align=None keeps coordinates)
rib = extrude(Plane.YZ * tri, amount=4, both=True)               # drawn on YZ, extruded 4 mm each way in X (8 mm total)
cup = revolve(Plane.XZ * Polygon((0, 0), (30, 0), (32, 60), (29, 60), (27, 3), (0, 3), align=None), Axis.Z)
adapter = loft([Plane.XY * Circle(10), Plane.XY.offset(20) * Rectangle(10, 10)])
```

## Chamfers, fillets, shells

```python
b = fillet(b.edges().filter_by(Axis.Z), radius=3)                # R3 on the 4 vertical edges
b = chamfer(b.edges().group_by(Axis.Z)[-1], length=1)            # C1 on the top edges
box = offset(Box(30, 30, 30, align=MIN), amount=-2,
             openings=Box(30, 30, 30, align=MIN).faces().sort_by(Axis.Z)[-1])   # open-top box, 2 mm walls
m = mirror(part, about=Plane.YZ)                                  # mirrored copy (left/right)
```

- Selecting edges: `.edges().filter_by(Axis.Z)` (parallel to Z), `.group_by(Axis.Z)[0]` (lowest group of edges), `.sort_by(Axis.Z)[-1]` (topmost face).
- Fillets fail easily. Use a smaller radius / fuse first, then fillet / fillet last.
- **Do not round the edges of the bottom face (the face on the bed)** (causes warping and detaching). A chamfer of about 0.5 mm is fine.

## Text

```python
label = extrude(Text("ABC", font_size=8), amount=0.8)            # font_size is roughly the text height
```

- For FDM, aim for text at least 5 mm tall, strokes at least 0.8 mm wide, and at least 0.6 mm raised or engraved.
- Without a font that has the needed glyphs (for example Japanese), those characters do not render. Pass a TTF with `font_path=` if needed, or discuss it with the user.

## FDM rules of thumb

| Shape | Rule of thumb |
|---|---|
| Horizontal hole | Point the top at 45° (teardrop) so it needs no support |
| Overhang | Make the underside a slope within 45° (chamfer). A right-angle overhang needs support |
| Screw hole (M3, untapped) | Pilot hole Ø2.5–2.8, clearance hole Ø3.4, countersink/counterbore as steps |
| Fit | 0.2–0.4 mm gap per side. Tight 0.15, loose 0.5 |
| Thin wall | 0.8 mm (two 0.4 mm nozzle lines) or more. 1.6–2.4 mm if it needs strength |
| Thin pin | Ø3 mm or more, with about R1 at the root |
| Joining parts | Overlap 0.5–1 mm (faces that only touch may be treated as separate bodies) |

## When things go wrong

- A `Compound` instead of a `Part` can still be passed to add_part (it is meshed).
- A boolean fails or a shape disappears → check for exactly coincident touching faces; shift by 0.01 mm or overlap them.
- Shapes that are hard to make in build123d can be made with manifold3d (`import manifold3d as mf`) and passed to add_part.
