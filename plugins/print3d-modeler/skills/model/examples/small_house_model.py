"""Sample: small house (build123d). A more detailed reference than the phone stand.

Parts: base / walls / roof / chimney / door / door canopy / step / windows; location label: ridge.
Shows how to keep decorative details printable without supports:
  - the body is solid, so the roof does not have to bridge across a hollow interior
  - eaves, the door canopy and horizontal window bars have undersides sloped ~40° from vertical
  - details stand out from the wall instead of being recessed (a recess leaves a ceiling that needs support)
Labels here are in English (lang="en"). For a Japanese-speaking user, write them in Japanese and set lang="ja".
"""
from build123d import Align, Box, Plane, Polygon, Pos, extrude
from p3d import LabeledModel  # run as PYTHONPATH=<runtime> <python> model.py

# ---- Parameters ----
W, D, H = 60.0, 46.0, 34.0          # walls: width (X), depth (Y), height (Z)
BASE_M, BASE_T = 8.0, 3.0           # base margin around the walls, thickness
RIDGE = 20.0                        # roof height above the walls
EAVE = 3.0                          # eave overhang front/back (underside chamfered, ~40° from vertical)
EAVE_DROP = 3.6
GABLE = -0.2                        # roof ends 0.2 mm inside the gable walls (no flat overhang, no coincident faces)
EMBED = 0.6                         # overlap so parts fuse

C = (Align.CENTER, Align.CENTER, Align.MIN)
z0 = BASE_T - EMBED                 # walls start here
zt = z0 + H                         # top of the walls
yF = -D / 2                         # front face of the walls

m = LabeledModel("small-house", title="Small house", lang="en")

m.add_part("base", "Base", Box(W + 2 * BASE_M, D + 2 * BASE_M, BASE_T, align=C),
           description="Plate the house stands on",
           key_dims={"width": W + 2 * BASE_M, "depth": D + 2 * BASE_M, "thickness": BASE_T})

walls = Pos(0, 0, z0) * Box(W, D, H + EMBED, align=C)
m.add_part("walls", "Walls", walls, description="Solid body of the house",
           key_dims={"width": W, "depth": D, "height": H})

# Roof: pentagon in the YZ plane, extruded along X. Eave undersides slope up at ~40° from vertical.
prof = Polygon((yF, zt - EAVE_DROP), (yF - EAVE, zt), (0, zt + RIDGE), (-yF + EAVE, zt), (-yF, zt - EAVE_DROP), align=None)
roof = extrude(Plane.YZ * prof, amount=W / 2 + GABLE, both=True)
m.add_part("roof", "Roof", roof, description="Gable roof",
           key_dims={"ridge height": RIDGE, "eaves": EAVE})

# Chimney on the back slope, rising above the roof
slope = RIDGE / (D / 2 + EAVE)
cy = 11.0                                   # chimney center Y (behind the ridge)
roof_z = zt + RIDGE - slope * cy            # roof surface height at the chimney
chimney = Pos(-16, cy, roof_z - 4) * Box(8, 8, 24, align=C)   # 4 mm sunk into the roof, 20 mm above it
m.add_part("chimney", "Chimney", chimney, description="On the back slope of the roof",
           key_dims={"size": "8×8"})

# Door: raised panel on the front wall (a recess would leave a ceiling that needs support)
DW, DH, P = 14.0, 22.0, 1.0         # door width, height; how far details stand out from the wall
door = Pos(0, yF - P / 2 + 0.1, z0) * Box(DW, P + 0.2, DH + EMBED, align=C)
m.add_part("door", "Door", door, description="Front door",
           key_dims={"width": DW, "height": DH})

# Door canopy: wedge whose underside is 40° from vertical
CAN_W, CAN_D = DW + 8, 5.0
cz0 = z0 + DH + 3
can = Polygon((yF + 0.5, cz0), (yF - CAN_D, cz0 + CAN_D * 1.19), (yF - CAN_D, cz0 + CAN_D * 1.19 + 2),
              (yF + 0.5, cz0 + CAN_D * 1.19 + 2), align=None)
m.add_part("canopy", "Door canopy", extrude(Plane.YZ * can, amount=CAN_W / 2, both=True),
           description="Small roof over the door; underside sloped so it needs no support")

# Front step
m.add_part("step", "Step", Pos(0, yF - 3.5, z0) * Box(DW + 6, 7, 2 + EMBED, align=C),
           description="Step in front of the door")

# Windows: raised frame with a cross. Horizontal bars have a sloped underside (no support needed).
WW, WH, WZ = 12.0, 12.0, z0 + 13    # window width, height, bottom Z
BAR = 1.6                            # bar width


def hbar(z, length, wall):
    """Horizontal bar of height BAR on a wall face, standing out P with an underside sloped ~40° from vertical."""
    prof = [(0.1, z), (-P, z + P * 1.2), (-P, z + BAR + P * 1.2), (0.1, z + BAR + P * 1.2)]
    if wall == "front":
        return Pos(wall_x, 0, 0) * extrude(Plane.YZ * Polygon(*[(yF + a, b) for a, b in prof], align=None),
                                         amount=length / 2, both=True)
    s = 1 if wall == "right" else -1
    return Pos(0, wall_y, 0) * extrude(Plane.XZ * Polygon(*[(s * (W / 2 - a), b) for a, b in prof], align=None),
                                     amount=length / 2, both=True)


def vbar(c, z, height, wall):
    if wall == "front":
        return Pos(c, yF - P / 2 + 0.05, z) * Box(BAR, P + 0.1, height, align=C)
    s = 1 if wall == "right" else -1
    return Pos(s * (W / 2 + P / 2 - 0.05), c, z) * Box(P + 0.1, BAR, height, align=C)


frames = None
for wall, c in (("front", -19), ("front", 19), ("right", 0), ("left", 0)):
    wall_x = c if wall == "front" else 0
    wall_y = c if wall != "front" else 0
    L = WW + 2 * BAR
    parts = [hbar(WZ - BAR, L, wall), hbar(WZ + WH, L, wall), hbar(WZ + WH / 2 - BAR / 2, WW, wall),
             vbar(c - WW / 2 - BAR / 2, WZ - BAR, WH + 2 * BAR, wall),
             vbar(c + WW / 2 + BAR / 2, WZ - BAR, WH + 2 * BAR, wall),
             vbar(c, WZ, WH, wall)]
    for p in parts:
        frames = p if frames is None else frames + p
m.add_part("windows", "Windows", frames,
           description="Four window frames with a cross",
           key_dims={"size": f"{WW:g}×{WH:g}"})

m.add_feature("ridge", "Ridge", (0, 0, zt + RIDGE), description="Top of the roof")

m.set_print_orientation(rotation_deg=(0, 0, 0), bed_face="bottom of the base")
m.print_note = "Print as it stands, base down. Eaves, canopy and window frames are sloped or short enough to print without support."

if __name__ == "__main__":
    import json
    print(json.dumps(m.build(__file__), ensure_ascii=False, indent=1))
