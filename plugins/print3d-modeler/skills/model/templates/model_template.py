"""<モデルの日本語名>（<model-slug>）

実行: P3D_RUNTIME=<runtime> <python> model.py
座標系: 上 = +Z（Z=0 がベッド面）、正面（手前）= -Y、右 = +X、単位 mm。使うときの向きで作る。
"""
import json
import os
import sys

sys.path.insert(0, os.environ["P3D_RUNTIME"])
from build123d import *  # noqa: E402,F403
from p3d import LabeledModel  # noqa: E402

# ---- パラメータ（要件 ID をコメントで対応づける）--------------------------
EMBED = 1.0        # 部位同士の重なり。結合を確実にする

m = LabeledModel("<model-slug>", title="<モデルの日本語名>")

# ---- 部位 ----------------------------------------------------------------
# part = Box(..., align=(Align.CENTER, Align.CENTER, Align.MIN))
# m.add_part("base", "台座", part, description="…", key_dims={"幅": 80}, requirements=["R1"])

# ---- 場所ラベル・切り抜き -------------------------------------------------
# m.add_cut(Pos(...) * Cylinder(...), parts=["base"])
# m.add_feature("screw_hole", "ねじ穴", (x, y, z), description="M3 用 φ3.4")

# ---- 印刷の向き -----------------------------------------------------------
m.set_print_orientation(rotation_deg=(0, 0, 0), bed_face="<どの面を下にするか>")
m.print_note = ""

if __name__ == "__main__":
    print(json.dumps(m.build(__file__), ensure_ascii=False, indent=2))
