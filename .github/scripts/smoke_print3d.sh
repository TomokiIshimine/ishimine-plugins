#!/usr/bin/env bash
# End-to-end smoke test for print3d-modeler: build the sample model with the plugin runtime and
# run every CLI the skills use (analyze / measure / viewer / printer / export).
#
#   .github/scripts/smoke_print3d.sh <python> <work dir>
#
# <python> is the interpreter printed by runtime/setup_env.sh. The model folder ends up in
# <work dir>/phone-stand (kept so CI can upload it).
set -euo pipefail

PY="$1"
WORK="$2"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLUGIN="${REPO}/plugins/print3d-modeler"
RT="${PLUGIN}/runtime"
M="${WORK}/phone-stand"

rm -rf "$M"
mkdir -p "$M"
cp "${PLUGIN}/skills/model/examples/phone_stand_model.py" "${M}/model.py"

step() { echo; echo "::group::$*"; }
end() { echo "::endgroup::"; }
need() { for f in "$@"; do [ -s "${M}/${f}" ] || { echo "::error::missing or empty: ${f}"; exit 1; }; done; }

step "model.py (LabeledModel.build)"
(cd "$M" && PYTHONPATH="$RT" "$PY" model.py) | tee "${WORK}/build.json"
end
need parts.json analysis.json viewer.html out/model.glb out/model.stl out/model.step \
     out/parts/base.stl out/parts/backrest.stl out/parts/front_lip.stl out/parts/rib.stl out/print/main.stl
"$PY" - "${WORK}/build.json" <<'PY'
import json, sys
r = json.load(open(sys.argv[1]))
assert r["auto_check"] == "PASS", f"sample model should pass the automatic check: {r}"
assert not r["critical_or_major"], r["critical_or_major"]
PY
"$PY" - "${M}/parts.json" <<'PY'
import json, sys
pj = json.load(open(sys.argv[1]))
lay = pj["print_layout"]
assert lay["plates"] == 1, lay
assert all(g["plate"] == 1 and g["bed_fit"] == "fits" for g in pj["print_orientation"]["groups"].values()), pj
PY

cd "$RT"

step "p3d.analyze"
"$PY" -m p3d.analyze "$M"
end

step "p3d.measure"
"$PY" -m p3d.measure "$M" > "${WORK}/measure.json"
"$PY" -m p3d.measure "$M" --part backrest > /dev/null
"$PY" -m p3d.measure "$M" --section z=30 > /dev/null
"$PY" -m p3d.measure "$M" --distance base rib > /dev/null
"$PY" -m p3d.measure "$M" --ray 0,-60,10 0,1,0 > /dev/null
"$PY" - "${WORK}/measure.json" <<'PY'
import json, sys
r = json.load(open(sys.argv[1]))
ids = sorted(p["id"] for p in r["parts"])
assert ids == ["backrest", "base", "front_lip", "rib"], ids
assert r["overall_min"][2] == 0.0, f"model should rest on the bed (Z=0): {r['overall_min']}"
PY
echo "measure ok"
end

step "p3d.viewer (ja and en)"
"$PY" -m p3d.viewer "$M" --lang ja
cp "${M}/viewer.html" "${M}/viewer.ja.html"
"$PY" -m p3d.viewer "$M" --lang en
end

step "p3d.printer"
"$PY" -m p3d.printer "$M" > /dev/null
"$PY" -m p3d.printer --presets > /dev/null
"$PY" -m p3d.printer --find "A1 mini" | grep -q '"bambu-a1-mini"'
"$PY" -m p3d.printer --save "${WORK}/printer-check" --preset bambu-h2d --nozzle-mode dual --folder-only > /dev/null
"$PY" -m p3d.printer "${WORK}/printer-check/model" | grep -q '"nozzle_mode": "dual"'
end

step "p3d.export"
"$PY" -m p3d.export "$M" | tee "${WORK}/export.json"
end
need out/final/phone-stand.3mf out/final/phone-stand_main.stl

step "p3d.layout (concave pieces nest on one plate)"
"$PY" - <<'PY'
import itertools
import trimesh
from shapely.geometry import Polygon
from p3d.layout import arrange, outline_xy, placement_matrix

# two L shapes of 200 x 200 mm (arms 40 mm wide): side by side they need two 256 mm plates, nested they fit one
L = Polygon([(0, 0), (200, 0), (200, 40), (40, 40), (40, 200), (0, 200)])
pieces = {"l1": trimesh.creation.extrude_polygon(L, 5), "l2": trimesh.creation.extrude_polygon(L, 5)}
r = arrange(pieces, (256, 256, 256), 6.0)
assert r["plates"] == 1, r
placed = []
for g, m in pieces.items():
    m = m.copy()
    m.apply_transform(placement_matrix(m, r["pieces"][g], r["plate_pitch_mm"]))
    lo, hi = m.bounds
    assert lo[0] >= -128.01 and lo[1] >= -128.01 and hi[0] <= 128.01 and hi[1] <= 128.01, (g, m.bounds)
    placed.append(outline_xy(m))
gap = min(a.distance(b) for a, b in itertools.combinations(placed, 2))
assert gap >= 6.0 - 1e-6, f"pieces closer than part_spacing_mm: {gap}"
# a pin lying on its side: its outline from above is the full 24 x 4 mm rectangle, not slivers
pin = trimesh.creation.cylinder(radius=2, height=24, sections=32)
pin.apply_transform(trimesh.transformations.rotation_matrix(1.5708, (1, 0, 0)))
assert abs(outline_xy(pin).area - 96) < 2, outline_xy(pin).area
# overhangs: a 10 x 10 mm stem under a 60 x 60 mm cap is packed by the cap, not by the face on the bed
stem = trimesh.creation.box((10, 10, 20)); stem.apply_translation((0, 0, 10))
cap = trimesh.creation.box((60, 60, 5)); cap.apply_translation((0, 0, 22.5))
mush = trimesh.boolean.union([stem, cap])
assert abs(outline_xy(mush).area - 3600) < 5, outline_xy(mush).area
caps = {f"m{i}": mush.copy() for i in range(4)}
r2 = arrange(caps, (180, 180, 180), 6.0)
tops = []
for g, m in caps.items():
    m = m.copy()
    m.apply_transform(placement_matrix(m, r2["pieces"][g], r2["plate_pitch_mm"]))
    tops.append(outline_xy(m))
gap2 = min(a.distance(b) for a, b in itertools.combinations(tops, 2))
assert gap2 >= 6.0 - 1e-6, f"overhanging caps closer than part_spacing_mm: {gap2}"
print("nesting ok", {g: p["turn_deg"] for g, p in r["pieces"].items()}, "gap", round(gap, 2))
PY
end

step "p3d.export (two objects with the same label on one plate)"
D="${WORK}/same-label"
rm -rf "$D" && mkdir -p "$D"
cat > "${D}/model.py" <<'PY'
from build123d import Align, Box, Pos
from p3d import LabeledModel

m = LabeledModel("same-label", title="Same label", lang="en")
for g, x in (("a", 0), ("b", 60)):
    m.add_part(g, g.upper(), Pos(x, 0, 0) * Box(30, 30, 10, align=(Align.CENTER, Align.CENTER, Align.MIN)), print_group=g)
    m.set_object_label(g, "Block")
m.set_print_orientation((0, 0, 0), bed_face="bottom")
m.build(__file__)
PY
(cd "$D" && PYTHONPATH="$RT" "$PY" model.py) > /dev/null
"$PY" -m p3d.export "$D" > /dev/null
"$PY" - "${D}/out/final/same-label.3mf" <<'PY'
import sys
import trimesh
s = trimesh.load(sys.argv[1])
assert len(s.graph.nodes_geometry) == 2, f"a piece went missing: {s.graph.nodes_geometry}"
PY
echo "same-label ok"
end

step "p3d.export (Bambu Lab printer: Bambu Studio project with plates)"
echo '{"preset": "bambu-a1"}' > "${M}/printer.json"
(cd "$M" && PYTHONPATH="$RT" "$PY" model.py) > /dev/null
"$PY" -m p3d.export "$M" > "${WORK}/export-bambu.json"
"$PY" - "${M}/out/final/phone-stand.3mf" "${WORK}/export-bambu.json" <<'PY'
import json, re, sys, zipfile
import trimesh
from p3d.bambu import plate_origin, project_for, write_project

z = zipfile.ZipFile(sys.argv[1])
names = set(z.namelist())
for f in ("3D/3dmodel.model", "3D/_rels/3dmodel.model.rels", "Metadata/model_settings.config", "Metadata/project_settings.config"):
    assert f in names, f"missing {f}: {sorted(names)}"
root = z.read("3D/3dmodel.model").decode()
assert '<metadata name="Application">BambuStudio-' in root, "Bambu Studio reads plates only from its own projects"
ps = json.loads(z.read("Metadata/project_settings.config"))
assert ps["printer_settings_id"] == "Bambu Lab A1 0.4 nozzle" and ps["print_settings_id"] == "0.20mm Standard @BBL A1", ps
assert z.read("Metadata/model_settings.config").decode().count("<plate>") == 1
r = json.load(open(sys.argv[2]))
assert r["files"]["3mf"] == ["out/final/phone-stand.3mf"] and r["slicer_project"], r

# two plates of an A1 (256 mm bed): Bambu Studio draws plate 2 at x = 256 * 1.2, plate 3 below plate 1 (2 columns)
assert plate_origin(1, 2, (256, 256)) == (307.2, 0.0) and plate_origin(2, 4, (256, 256)) == (0.0, -307.2)
box = trimesh.creation.box((40, 30, 10))
box.apply_translation((128, 128, 5))
out = sys.argv[1].replace(".3mf", "_two.3mf")
write_project(out, [[("a", box)], [("b", box.copy())]], project_for({"preset": "bambu-a1", "nozzle_mm": 0.4}))
z = zipfile.ZipFile(out)
items = re.findall(r'<item [^>]*transform="1 0 0 0 1 0 0 0 1 ([-\d.]+) ([-\d.]+) ', z.read("3D/3dmodel.model").decode())
assert [tuple(map(float, i)) for i in items] == [(128.0, 128.0), (435.2, 128.0)], items
cfg = z.read("Metadata/model_settings.config").decode()
assert cfg.count("<plate>") == 2 and '<metadata key="plater_id" value="2"/>' in cfg
# labels need not be unique: two pieces with the same name stay two objects
placed = write_project(out, [[("a", box), ("a", box.copy())]], project_for({"preset": "bambu-a1", "nozzle_mm": 0.4}))
assert len(placed) == 2 and zipfile.ZipFile(out).read("3D/3dmodel.model").decode().count("<item ") == 2, placed
print("Bambu Studio project ok")
PY
end

step "multi-color model (filaments by color and material, later parts win, Bambu Studio project and plain 3MF)"
C="${WORK}/multicolor"
rm -rf "$C" && mkdir -p "$C"
cat > "${C}/model.py" <<'PY'
from build123d import Align, Box, Pos
from p3d import LabeledModel

BOT = (Align.CENTER, Align.CENTER, Align.MIN)
m = LabeledModel("multicolor", title="Tag", lang="en")
m.add_filament("body", color="#F2F2F2", material="PLA", label="Body (white)")
m.add_filament("stripe", color="#1A1A1A", label="Stripe (black)")          # material not decided
m.add_filament("unused", color="#00FF00", material="PLA", label="Unused")   # used by no part: not in the 3MF
m.add_filament("dot", color="#D62828", material="PLA Matte", label="Dot (red)")
m.add_part("plate", "Plate", Box(60, 30, 4, align=BOT), filament="body")
# sunk 1 mm into the plate and standing 1 mm proud: the later part wins the shared volume
m.add_part("stripe", "Stripe", Pos(0, 0, 3) * Box(40, 6, 2, align=BOT), filament="stripe")
m.add_part("dot", "Dot", Pos(0, 50, 0) * Box(12, 12, 3, align=BOT), filament="dot", print_group="dot")
m.set_print_orientation((0, 0, 0), bed_face="bottom")
m.build(__file__)
PY
echo '{"preset": "bambu-a1"}' > "${C}/printer.json"
(cd "$C" && PYTHONPATH="$RT" "$PY" model.py) > /dev/null
"$PY" -m p3d.export "$C" --material dot=PETG > "${WORK}/export-multicolor.json"
"$PY" - "$C" "${WORK}/export-multicolor.json" <<'PY'
import json, re, sys, zipfile
from pathlib import Path
import trimesh

d = Path(sys.argv[1])
pj = json.loads((d / "parts.json").read_text(encoding="utf-8"))
assert [f["id"] for f in pj["filaments"]] == ["body", "stripe", "dot"], pj["filaments"]
assert pj["filaments"][1]["material"] is None and pj["filaments"][2]["material"] == "PLA Matte"
groups = pj["print_orientation"]["groups"]
assert groups["main"]["filaments"] == ["body", "stripe"] and groups["dot"]["filaments"] == ["dot"], groups
assert groups["main"]["hidden_parts"] == [] and "hidden_parts" not in groups["dot"], groups
whole = trimesh.load(d / "out/print/main.stl")
body, stripe = (trimesh.load(d / f"out/print/main.{f}.stl") for f in ("body", "stripe"))
assert abs(stripe.volume - 40 * 6 * 2) < 1 and abs(body.volume + stripe.volume - whole.volume) < 1, \
    (body.volume, stripe.volume, whole.volume)
assert not (d / "out/print/dot.dot.stl").exists()
a = json.loads((d / "analysis.json").read_text(encoding="utf-8"))
assert a["filaments"]["count"] == 3 and a["filaments"]["max_filaments"] == 4, a["filaments"]
assert a["filaments"]["estimated_changes"] > 0, a["filaments"]

r = json.load(open(sys.argv[2]))
assert r["multicolor"] and [f["filament"] for f in r["filaments"]] == [1, 2, 3], r["filaments"]
st, dot = r["filaments"][1], r["filaments"][2]
assert not st["material_decided"] and st["material"] == "PLA", st
assert dot["material"] == "PETG" and dot["material_decided"] and dot["slicer_preset"] == "Bambu PETG HF @BBL A1", dot
assert any("--material stripe=" in w for w in r["layout"]["warnings"]), r["layout"]["warnings"]
assert r["slicer_project"]["filament_presets"] == ["Bambu PLA Basic @BBL A1"] * 2 + ["Bambu PETG HF @BBL A1"]
assert sorted(r["files"]["filament_stl"]) == ["out/final/multicolor_main_body.stl", "out/final/multicolor_main_stripe.stl"]

z = zipfile.ZipFile(d / "out/final/multicolor.3mf")
ps = json.loads(z.read("Metadata/project_settings.config"))
assert ps["filament_colour"] == ["#F2F2F2", "#1A1A1A", "#D62828"], ps
assert len(ps["filament_settings_id"]) == 3 and len(ps["inherits_group"]) == 5 == len(ps["different_settings_to_system"])
cfg = z.read("Metadata/model_settings.config").decode()
objs = re.findall(r'<object id="\d+">(.*?)</object>', cfg, re.S)
assert len(objs) == 2, cfg
parts = re.findall(r'<part id="(\d+)"(.*?)</part>', objs[0], re.S)
assert [re.search(r'key="extruder" value="(\d)"', p).group(1) for _, p in parts] == ["1", "2"], objs[0]
assert '<metadata key="extruder" value="3"/>' in objs[1] and objs[1].count("<part ") == 1, objs[1]
root = z.read("3D/3dmodel.model").decode()
assert root.count("<component ") == 3, root
print("multi-color Bambu project ok")
PY
# the same model for a printer without a Bambu Studio project: a plain 3MF with the colors as base materials
echo '{"preset": "prusa-mk4"}' > "${C}/printer.json"
(cd "$C" && PYTHONPATH="$RT" "$PY" model.py) > /dev/null
"$PY" -m p3d.export "$C" > /dev/null
"$PY" - "${C}/out/final/multicolor.3mf" <<'PY'
import sys, zipfile
import trimesh
m = zipfile.ZipFile(sys.argv[1]).read("3D/3dmodel.model").decode()
assert m.count("<base ") == 3 and 'displaycolor="#1A1A1AFF"' in m and m.count('pid="1"') == 3, m[:800]
s = trimesh.load(sys.argv[1])
assert len(s.geometry) == 3, s.geometry
print("multi-color plain 3MF ok")
PY
"$PY" -m p3d.viewer "$C" --lang en > /dev/null
grep -q '"filaments": \[{"id": "body"' "${C}/viewer.html"
"$PY" - <<'PY'
import trimesh
from p3d.filament import resolve_overlaps
a = trimesh.creation.box((10, 10, 10))
b = trimesh.creation.box((10, 10, 10)); b.apply_translation((5, 0, 0))
r = resolve_overlaps([a, b], ["x", "y"])
assert abs(r["x"].volume - 500) < 1e-6 and abs(r["y"].volume - 1000) < 1e-6, {k: v.volume for k, v in r.items()}
r = resolve_overlaps([a, b, a.copy()], ["x", "y", "x"])    # a later part of the first filament wins back its volume
assert abs(r["x"].volume - 1000) < 1e-6 and abs(r["y"].volume - 500) < 1e-6, {k: v.volume for k, v in r.items()}
from p3d.filament import hidden_parts
c = trimesh.creation.box((4, 4, 4)); c.apply_translation((20, 0, 0))
# two parts of filament x, the second (c) entirely inside a later part of y: c is hidden although x still prints
big = trimesh.creation.box((6, 6, 6)); big.apply_translation((20, 0, 0))
assert hidden_parts([a, c, big], ["x", "x", "y"]) == [1]
assert hidden_parts([a, b], ["x", "y"]) == [] and hidden_parts([c, big], ["x", "x"]) == []
print("later parts win ok")
PY
# a covered part is reported even when another part of the same filament still prints
H="${WORK}/hidden"
rm -rf "$H" && mkdir -p "$H"
cat > "${H}/model.py" <<'PY'
from build123d import Align, Box, Pos
from p3d import LabeledModel

BOT = (Align.CENTER, Align.CENTER, Align.MIN)
m = LabeledModel("hidden", title="Hidden", lang="en")
m.add_filament("white", color="#F2F2F2", material="PLA")
m.add_filament("black", color="#1A1A1A", material="PLA")
m.add_part("plate", "Plate", Box(40, 20, 4, align=BOT), filament="white")
m.add_part("mark", "Mark", Pos(10, 0, 1) * Box(4, 4, 2, align=BOT), filament="white")
m.add_part("cover", "Cover", Pos(10, 0, 0) * Box(8, 8, 6, align=BOT), filament="black")
m.set_print_orientation((0, 0, 0), bed_face="bottom")
m.build(__file__)
PY
echo '{"preset": "bambu-a1"}' > "${H}/printer.json"
(cd "$H" && PYTHONPATH="$RT" "$PY" model.py) > /dev/null
"$PY" - "$H" <<'PY'
import json, sys
from pathlib import Path
d = Path(sys.argv[1])
g = json.loads((d / "parts.json").read_text(encoding="utf-8"))["print_orientation"]["groups"]["main"]
assert g["filaments"] == ["white", "black"] and g["hidden_parts"] == ["mark"], g
a = json.loads((d / "analysis.json").read_text(encoding="utf-8"))
hits = [x for x in a["findings"] if x["check"] == "filaments" and "completely covered" in x["issue"]]
assert [x["part"] for x in hits] == ["mark"], hits
print("hidden part ok")
PY
end

echo
echo "print3d-modeler smoke test passed"
