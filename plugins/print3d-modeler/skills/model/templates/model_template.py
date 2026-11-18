"""<model name> (<model-slug>)

Run: PYTHONPATH=<runtime> <python> model.py
Coordinates: up = +Z (Z=0 is the bed), front = -Y, right = +X, millimeters. Build the model as it is used.
Write the title, labels, descriptions and key_dims names in the user's language, and set lang to match.
"""
import json

from build123d import *  # noqa: F403
from p3d import LabeledModel  # the runtime is on PYTHONPATH (see "Run" above)

# ---- Parameters (link each to its requirement ID in a comment) ------------
EMBED = 1.0        # overlap between parts so they fuse reliably

m = LabeledModel("<model-slug>", title="<model name>", lang="<en|ja>")

# ---- Filaments (multi-color only; leave out for one color) ---------------
# m.add_filament("body", color="#F2F2F2", material="PLA", label="Body (white)")
# m.add_filament("text", color="#1A1A1A", label="Letters (black)")   # material not decided yet

# ---- Parts ---------------------------------------------------------------
# part = Box(..., align=(Align.CENTER, Align.CENTER, Align.MIN))
# m.add_part("base", "Base", part, description="…", key_dims={"width": 80}, requirements=["R1"])
# multi-color: add filament="body" to each part; add colored details after the part they sit in (later parts win)

# ---- Location labels and cuts --------------------------------------------
# m.add_cut(Pos(...) * Cylinder(...), parts=["base"])
# m.add_feature("screw_hole", "Screw hole", (x, y, z), description="Ø3.4 for M3")

# ---- Print orientation ---------------------------------------------------
m.set_print_orientation(rotation_deg=(0, 0, 0), bed_face="<which face goes down>")
m.print_note = ""

if __name__ == "__main__":
    print(json.dumps(m.build(__file__), ensure_ascii=False, indent=2))
