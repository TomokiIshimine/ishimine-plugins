"""Sample: phone stand (build123d). A reference for how to write model.py.

Parts: base / backrest / front lip / support rib; location label: cable slot.
Labels here are in English (lang="en"). For a Japanese-speaking user, write them in Japanese and set lang="ja".
"""
import math
import os
import sys

sys.path.insert(0, os.environ.get("P3D_RUNTIME", ""))   # runtime path printed by setup_env.sh
from build123d import Align, Box, Plane, Polygon, Pos, Rot, extrude  # noqa: E402
from p3d import LabeledModel  # noqa: E402

# ---- Parameters (values changed during the conversation; requirement IDs in comments) ----
BASE_W, BASE_D, BASE_T = 80.0, 90.0, 6.0     # base width, depth, thickness       R1
BACK_W, BACK_H, BACK_T = 70.0, 100.0, 6.0    # backrest width, height, thickness  R2
BACK_TILT = 20.0                             # backrest tilt backward [deg]       R3
BACK_Y = 5.0                                 # Y of the backrest's front face at its root
LIP_H, LIP_T, LIP_Y = 14.0, 6.0, -35.0       # front lip height, thickness, position  R4
RIB_T = 8.0                                  # support rib thickness
SLOT_W = 16.0                                # cable slot width                   R5
EMBED = 1.0                                  # overlap between parts (so they fuse reliably)

MIN = (Align.CENTER, Align.MIN, Align.MIN)

m = LabeledModel("phone-stand", title="Phone stand", lang="en")

base = Box(BASE_W, BASE_D, BASE_T, align=(Align.CENTER, Align.CENTER, Align.MIN))
m.add_part("base", "Base", base, description="Plate that sits on the bed",
           key_dims={"width": BASE_W, "depth": BASE_D, "thickness": BASE_T}, requirements=["R1"])

back = Box(BACK_W, BACK_T, BACK_H + EMBED, align=MIN)
back = Pos(0, BACK_Y, BASE_T - EMBED) * Rot(-BACK_TILT, 0, 0) * back
m.add_part("backrest", "Backrest", back, description="Plate that supports the back of the phone",
           key_dims={"height": BACK_H, "tilt": f"{BACK_TILT:g}° backward"}, requirements=["R2", "R3"])

lip = Pos(0, LIP_Y - LIP_T, BASE_T - EMBED) * Box(BACK_W, LIP_T, LIP_H + EMBED, align=MIN)
m.add_part("front_lip", "Front lip", lip, description="Stops the bottom edge of the phone from sliding",
           key_dims={"height": LIP_H}, requirements=["R4"])

t = math.tan(math.radians(BACK_TILT))
rear0 = BACK_Y + BACK_T / math.cos(math.radians(BACK_TILT))
tri = Polygon((rear0 - 2, BASE_T - EMBED), (BASE_D / 2 - 2, BASE_T - EMBED),
              (rear0 - 2 + 55 * t, BASE_T + 55), align=None)
rib = extrude(Plane.YZ * tri, amount=RIB_T / 2, both=True)
m.add_part("rib", "Support rib", rib, description="Triangular brace behind the backrest")

# Cable slot in the middle of the front lip (cuts the front lip only)
m.add_cut(Pos(0, LIP_Y - LIP_T / 2, BASE_T + 2) * Box(SLOT_W, LIP_T + 2, LIP_H + 2,
                                                       align=(Align.CENTER, Align.CENTER, Align.MIN)),
          parts=["front_lip"])
m.add_feature("cable_slot", "Cable slot", (0, LIP_Y - LIP_T / 2, BASE_T + 2),
              description=f"{SLOT_W:g} mm wide slot", requirements=["R5"])

m.set_print_orientation(rotation_deg=(0, 0, 0), bed_face="bottom of the base")
m.print_note = "Print with the bottom of the base down. The back of the backrest is under 45°, so no support is expected"

if __name__ == "__main__":
    import json
    print(json.dumps(m.build(__file__), ensure_ascii=False, indent=2))
