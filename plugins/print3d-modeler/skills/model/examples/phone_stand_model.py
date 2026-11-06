"""サンプル: スマホスタンド（build123d 版）。model.py の書き方の見本。

部位: 台座 / 背もたれ / 前ストッパー / 補強リブ、場所ラベル: ケーブル用切り欠き
"""
import math
import os
import sys

sys.path.insert(0, os.environ.get("P3D_RUNTIME", ""))   # setup_env.sh が表示した runtime パス
from build123d import Align, Box, Plane, Polygon, Pos, Rot, extrude  # noqa: E402
from p3d import LabeledModel  # noqa: E402

# ---- パラメータ（ユーザーとの会話で変える値。要件 ID をコメントで対応づける）----
BASE_W, BASE_D, BASE_T = 80.0, 90.0, 6.0     # 台座 幅・奥行・厚み          R1
BACK_W, BACK_H, BACK_T = 70.0, 100.0, 6.0    # 背もたれ 幅・高さ・厚み      R2
BACK_TILT = 20.0                             # 背もたれの後ろへの傾き [deg]  R3
BACK_Y = 5.0                                 # 背もたれ前面の付け根（Y）
LIP_H, LIP_T, LIP_Y = 14.0, 6.0, -35.0       # 前ストッパー 高さ・厚み・位置  R4
RIB_T = 8.0                                  # 補強リブの厚み
SLOT_W = 16.0                                # ケーブル用切り欠きの幅        R5
EMBED = 1.0                                  # 部位同士の重なり（確実に結合させる）

MIN = (Align.CENTER, Align.MIN, Align.MIN)

m = LabeledModel("phone-stand", title="スマホスタンド")

base = Box(BASE_W, BASE_D, BASE_T, align=(Align.CENTER, Align.CENTER, Align.MIN))
m.add_part("base", "台座", base, description="ベッドに接地する土台の板",
           key_dims={"幅": BASE_W, "奥行": BASE_D, "厚み": BASE_T}, requirements=["R1"])

back = Box(BACK_W, BACK_T, BACK_H + EMBED, align=MIN)
back = Pos(0, BACK_Y, BASE_T - EMBED) * Rot(-BACK_TILT, 0, 0) * back
m.add_part("backrest", "背もたれ", back, description="スマホの背面を支える板",
           key_dims={"高さ": BACK_H, "傾き": f"後ろへ{BACK_TILT:g}°"}, requirements=["R2", "R3"])

lip = Pos(0, LIP_Y - LIP_T, BASE_T - EMBED) * Box(BACK_W, LIP_T, LIP_H + EMBED, align=MIN)
m.add_part("front_lip", "前ストッパー", lip, description="スマホの下端が滑らないよう止める",
           key_dims={"高さ": LIP_H}, requirements=["R4"])

t = math.tan(math.radians(BACK_TILT))
rear0 = BACK_Y + BACK_T / math.cos(math.radians(BACK_TILT))
tri = Polygon((rear0 - 2, BASE_T - EMBED), (BASE_D / 2 - 2, BASE_T - EMBED),
              (rear0 - 2 + 55 * t, BASE_T + 55), align=None)
rib = extrude(Plane.YZ * tri, amount=RIB_T / 2, both=True)
m.add_part("rib", "補強リブ", rib, description="背もたれの裏から支える三角の柱")

# 前ストッパー中央のケーブル用切り欠き（前ストッパーだけ削る）
m.add_cut(Pos(0, LIP_Y - LIP_T / 2, BASE_T + 2) * Box(SLOT_W, LIP_T + 2, LIP_H + 2,
                                                       align=(Align.CENTER, Align.CENTER, Align.MIN)),
          parts=["front_lip"])
m.add_feature("cable_slot", "ケーブル用切り欠き", (0, LIP_Y - LIP_T / 2, BASE_T + 2),
              description=f"幅 {SLOT_W:g}mm の溝", requirements=["R5"])

m.set_print_orientation(rotation_deg=(0, 0, 0), bed_face="台座の底面")
m.print_note = "台座の底面を下にして印刷。背もたれの裏は 45° 未満なのでサポート不要の見込み"

if __name__ == "__main__":
    import json
    print(json.dumps(m.build(__file__), ensure_ascii=False, indent=2))
