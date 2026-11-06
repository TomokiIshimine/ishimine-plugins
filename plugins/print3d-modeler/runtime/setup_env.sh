#!/usr/bin/env bash
# print3d-modeler の Python 実行環境を用意し、使うべきパスを表示する。
# 何度実行してもよい（入っていれば数秒で終わる）。
# 出力の最後の行は JSON: {"python": ..., "runtime": ..., "plugin_root": ...}
set -euo pipefail

RUNTIME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$RUNTIME_DIR")"
DATA_DIR="${CLAUDE_PLUGIN_DATA:-${HOME}/.print3d-modeler}"
VENV="${DATA_DIR}/venv"
STAMP="${VENV}/.p3d-requirements"

find_python() {
  for c in python3.13 python3.12 python3.11 python3.10 python3 python; do
    if command -v "$c" >/dev/null 2>&1; then
      if "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
        echo "$c"; return 0
      fi
    fi
  done
  return 1
}

if [ -x "${VENV}/bin/python" ]; then
  PY="${VENV}/bin/python"
elif [ -x "${VENV}/Scripts/python.exe" ]; then
  PY="${VENV}/Scripts/python.exe"
else
  BASE_PY="$(find_python)" || { echo "ERROR: Python 3.10 以上が見つかりません" >&2; exit 1; }
  mkdir -p "$DATA_DIR"
  echo "Python 仮想環境を作成しています: ${VENV}" >&2
  "$BASE_PY" -m venv "$VENV"
  if [ -x "${VENV}/bin/python" ]; then PY="${VENV}/bin/python"; else PY="${VENV}/Scripts/python.exe"; fi
fi

if ! cmp -s "${RUNTIME_DIR}/requirements.txt" "$STAMP" 2>/dev/null \
   || ! "$PY" -c 'import build123d, trimesh, manifold3d' >/dev/null 2>&1; then
  echo "依存パッケージをインストールしています（初回は数分かかります）..." >&2
  "$PY" -m pip install -q --disable-pip-version-check --upgrade pip >&2 || true
  "$PY" -m pip install -q --disable-pip-version-check -r "${RUNTIME_DIR}/requirements.txt" >&2
  cp "${RUNTIME_DIR}/requirements.txt" "$STAMP"
fi

"$PY" - <<PYEOF
import json, build123d, trimesh, manifold3d, sys
print(json.dumps({
    "python": "${PY}",
    "runtime": "${RUNTIME_DIR}",
    "plugin_root": "${PLUGIN_ROOT}",
    "versions": {"python": sys.version.split()[0], "build123d": build123d.__version__,
                 "trimesh": trimesh.__version__},
}, ensure_ascii=False))
PYEOF
