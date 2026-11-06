"""print3d-modeler の Python ランタイム。

モデル生成コード（model.py）からは次のように使う:

    import sys; sys.path.insert(0, "<runtime ディレクトリ>")
    from p3d import LabeledModel
    from build123d import *

    m = LabeledModel("pen-stand", title="ペン立て")
    m.add_part("base", "土台", Cylinder(40, 8, align=(Align.CENTER, Align.CENTER, Align.MIN)),
               key_dims={"直径": 80, "高さ": 8}, requirements=["R1"])
    m.set_print_orientation(rotation_deg=(0, 0, 0), bed_face="土台の底面")
    m.build(__file__)   # model.py と同じフォルダに out/, parts.json, analysis.json, viewer.html を出力

座標系（全員共通・変更不可）: 単位 mm、上 = +Z（Z=0 がベッド面）、正面（手前）= -Y、右 = +X。
"""
from .model import LabeledModel  # noqa: F401
from .printer import load_printer, PRESETS  # noqa: F401
from .meshutil import DIRECTION_LABELS  # noqa: F401

__all__ = ["LabeledModel", "load_printer", "PRESETS", "DIRECTION_LABELS"]
