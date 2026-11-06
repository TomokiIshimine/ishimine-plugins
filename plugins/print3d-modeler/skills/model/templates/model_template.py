"""<model name> (<model-slug>)

Run: P3D_RUNTIME=<runtime> <python> model.py
Coordinates: up = +Z (Z=0 is the bed), front = -Y, right = +X, millimeters. Build the model as it is used.
Write the title, labels, descriptions and key_dims names in the user's language, and set lang to match.
"""
import json
import os
import sys

sys.path.insert(0, os.environ["P3D_RUNTIME"])
from build123d import *  # noqa: E402,F403
from p3d import LabeledModel  # noqa: E402

# ---- Parameters (link each to its requirement ID in a comment) ------------
EMBED = 1.0        # overlap between parts so they fuse reliably

m = LabeledModel("<model-slug>", title="<model name>", lang="<en|ja>")

# ---- Parts ---------------------------------------------------------------
# part = Box(..., align=(Align.CENTER, Align.CENTER, Align.MIN))
# m.add_part("base", "Base", part, description="…", key_dims={"width": 80}, requirements=["R1"])

# ---- Location labels and cuts --------------------------------------------
# m.add_cut(Pos(...) * Cylinder(...), parts=["base"])
# m.add_feature("screw_hole", "Screw hole", (x, y, z), description="Ø3.4 for M3")

# ---- Print orientation ---------------------------------------------------
m.set_print_orientation(rotation_deg=(0, 0, 0), bed_face="<which face goes down>")
m.print_note = ""

if __name__ == "__main__":
    print(json.dumps(m.build(__file__), ensure_ascii=False, indent=2))
