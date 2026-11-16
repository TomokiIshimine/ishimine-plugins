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
print("Bambu Studio project ok")
PY
end

echo
echo "print3d-modeler smoke test passed"
