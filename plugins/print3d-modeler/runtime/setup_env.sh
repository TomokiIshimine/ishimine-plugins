#!/usr/bin/env bash
# Set up the Python environment for print3d-modeler and print the paths to use.
# Safe to run any number of times (takes a few seconds once installed).
# The last line of output is JSON: {"python": ..., "runtime": ..., "plugin_root": ...}
set -euo pipefail

RUNTIME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$RUNTIME_DIR")"
DATA_DIR="${CLAUDE_PLUGIN_DATA:-${HOME}/.print3d-modeler}"
VENV="${DATA_DIR}/venv"
STAMP="${VENV}/.p3d-requirements"

find_python() {
  for c in python3.13 python3.12 python3.11 python3.10 python3 python; do
    if command -v "$c" >/dev/null 2>&1; then
      if "$c" "${RUNTIME_DIR}/check_env.py" version 2>/dev/null; then
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
  BASE_PY="$(find_python)" || { echo "ERROR: Python 3.10 or later was not found" >&2; exit 1; }
  mkdir -p "$DATA_DIR"
  echo "Creating the Python virtual environment: ${VENV}" >&2
  "$BASE_PY" -m venv "$VENV"
  if [ -x "${VENV}/bin/python" ]; then PY="${VENV}/bin/python"; else PY="${VENV}/Scripts/python.exe"; fi
fi

if ! cmp -s "${RUNTIME_DIR}/requirements.txt" "$STAMP" 2>/dev/null \
   || ! "$PY" "${RUNTIME_DIR}/check_env.py" deps >/dev/null 2>&1; then
  echo "Installing dependencies (the first run takes a few minutes)..." >&2
  "$PY" -m pip install -q --disable-pip-version-check --upgrade pip >&2 || true
  "$PY" -m pip install -q --disable-pip-version-check -r "${RUNTIME_DIR}/requirements.txt" >&2
  cp "${RUNTIME_DIR}/requirements.txt" "$STAMP"
fi

"$PY" "${RUNTIME_DIR}/check_env.py" report "$PY" "$RUNTIME_DIR" "$PLUGIN_ROOT"
