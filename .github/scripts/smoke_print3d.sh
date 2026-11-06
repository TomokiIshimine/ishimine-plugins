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
export P3D_RUNTIME="${PLUGIN}/runtime"
M="${WORK}/phone-stand"

rm -rf "$M"
mkdir -p "$M"
cp "${PLUGIN}/skills/model/examples/phone_stand_model.py" "${M}/model.py"

step() { echo; echo "::group::$*"; }
end() { echo "::endgroup::"; }
need() { for f in "$@"; do [ -s "${M}/${f}" ] || { echo "::error::missing or empty: ${f}"; exit 1; }; done; }

step "model.py (LabeledModel.build)"
(cd "$M" && "$PY" model.py) | tee "${WORK}/build.json"
end
need parts.json analysis.json viewer.html out/model.glb out/model.stl out/model.step \
     out/parts/base.stl out/parts/backrest.stl out/parts/front_lip.stl out/parts/rib.stl out/print/main.stl
"$PY" - "${WORK}/build.json" <<'PY'
import json, sys
r = json.load(open(sys.argv[1]))
assert r["auto_check"] == "PASS", f"sample model should pass the automatic check: {r}"
assert not r["critical_or_major"], r["critical_or_major"]
PY

cd "$P3D_RUNTIME"

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
end

step "p3d.export"
"$PY" -m p3d.export "$M" | tee "${WORK}/export.json"
end
need out/final/phone-stand.3mf out/final/phone-stand_main.stl

echo
echo "print3d-modeler smoke test passed"
