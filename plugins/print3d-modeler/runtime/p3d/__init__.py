"""Python runtime for print3d-modeler.

Use it from the model script (model.py), run as `PYTHONPATH=<runtime directory> <python> model.py`:

    from p3d import LabeledModel
    from build123d import *

    m = LabeledModel("pen-stand", title="Pen stand", lang="en")
    m.add_part("base", "Base", Cylinder(40, 8, align=(Align.CENTER, Align.CENTER, Align.MIN)),
               key_dims={"diameter": 80, "height": 8}, requirements=["R1"])
    m.set_print_orientation(rotation_deg=(0, 0, 0), bed_face="bottom of the base")
    m.build(__file__)   # writes out/, parts.json, analysis.json and viewer.html next to model.py

Coordinate system (shared by everyone, never changes): millimeters, up = +Z (Z=0 is the bed),
front = -Y, right = +X.
"""
from .model import LabeledModel  # noqa: F401
from .meshutil import DIRECTION_LABELS  # noqa: F401

__all__ = ["LabeledModel", "load_printer", "PRESETS", "DIRECTION_LABELS"]


def __getattr__(name):
    # Load p3d.printer only when asked for, so `python -m p3d.printer` does not find it already
    # imported by the package (runpy then prints a RuntimeWarning).
    if name in ("load_printer", "PRESETS"):
        from . import printer
        return getattr(printer, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
