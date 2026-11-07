"""Rebuild the three.js files that print3d-modeler inlines into viewer.html.

    python .github/scripts/build_three_bundle.py           # rewrite runtime/viewer/vendor/three-bundle.partNN.js
    python .github/scripts/build_three_bundle.py --check   # exit 1 if the committed parts differ from a fresh build

Needs Node.js with npm/npx. Installs the pinned three and esbuild into a temporary folder, bundles
vendor/three-bundle.entry.js as one IIFE without minifying (so the code stays readable), and splits the
result at line boundaries into parts under 240 KiB. The Anthropic plugin directory holds plugins with
files over 256 KiB or with code it cannot read, which is why the bundle is not minified and is split.
p3d.viewer joins the parts in order. This script lives outside the plugin because it runs a package launcher.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

THREE_VERSION = "0.160.0"
ESBUILD_VERSION = "0.24.2"
MAX_PART_BYTES = 240 * 1024

REPO = Path(__file__).resolve().parents[2]
VENDOR = REPO / "plugins/print3d-modeler/runtime/viewer/vendor"
ENTRY = VENDOR / "three-bundle.entry.js"
PART_GLOB = "three-bundle.part*.js"


def build() -> str:
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        shutil.copy(ENTRY, work / ENTRY.name)
        run = {"cwd": work, "check": True}
        subprocess.run(["npm", "init", "-y"], stdout=subprocess.DEVNULL, **run)
        subprocess.run(["npm", "install", "--silent", "--no-audit", "--no-fund",
                        f"three@{THREE_VERSION}", f"esbuild@{ESBUILD_VERSION}"], **run)
        subprocess.run(["npx", "esbuild", ENTRY.name, "--bundle", "--format=iife",
                        "--legal-comments=inline", "--outfile=bundle.js", "--log-level=warning"], **run)
        return (work / "bundle.js").read_text(encoding="utf-8")


def split(js: str) -> list[str]:
    parts, cur, size = [], [], 0
    for line in js.splitlines(keepends=True):
        n = len(line.encode("utf-8"))
        if cur and size + n > MAX_PART_BYTES:
            parts.append("".join(cur))
            cur, size = [], 0
        cur.append(line)
        size += n
    if cur:
        parts.append("".join(cur))
    return parts


def main() -> int:
    parts = split(build())
    names = [f"three-bundle.part{i:02d}.js" for i in range(1, len(parts) + 1)]
    if "--check" in sys.argv[1:]:
        committed = sorted(VENDOR.glob(PART_GLOB))
        same = [p.name for p in committed] == names and all(
            p.read_text(encoding="utf-8") == text for p, text in zip(committed, parts))
        print("three.js parts match a fresh build" if same else "three.js parts differ from a fresh build")
        return 0 if same else 1
    for old in VENDOR.glob(PART_GLOB):
        old.unlink()
    for name, text in zip(names, parts):
        (VENDOR / name).write_text(text, encoding="utf-8")
    print(f"wrote {len(parts)} parts ({sum(len(t.encode()) for t in parts)} bytes) to {VENDOR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
