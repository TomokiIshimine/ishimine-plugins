"""Decide which CI checks a change needs, from the list of changed files.

    git diff --name-only <base> HEAD | python .github/scripts/changed_areas.py
    python .github/scripts/changed_areas.py --all          # everything (manual runs, schedule, unknown base)

Prints `<area>=true|false` lines (CI appends them to $GITHUB_OUTPUT), plus `smoke_pythons=<JSON list>`
for the print3d end-to-end matrix. With $GITHUB_STEP_SUMMARY set, it also writes a table of what
runs and which files triggered it.

Patterns use fnmatch, where `*` also matches `/`. A change to the CI itself (the workflow or this
script) runs every check.
"""
from __future__ import annotations

import json
import os
import sys
from fnmatch import fnmatchcase

P3D = "plugins/print3d-modeler"

# area -> (include patterns, exclude patterns)
AREAS: dict[str, tuple[list[str], list[str]]] = {
    # claude plugin validate + check_manifests.py: manifests, skills, agents and other plugin components.
    # Runtime code and the plugin's READMEs / AGENTS.md are not part of what the validator checks.
    "manifests": (
        [".claude-plugin/*", "plugins/*", ".github/scripts/check_manifests.py"],
        ["plugins/*/runtime/*", "plugins/*/README.md", "plugins/*/README.ja.md", "plugins/*/AGENTS.md"],
    ),
    "python_lint": (["*.py", "ruff.toml"], []),
    "shell_lint": (["*.sh"], []),
    # Build the sample model and run every p3d CLI (Python 3.13).
    "print3d_smoke": (
        [f"{P3D}/runtime/*", f"{P3D}/skills/model/examples/*",
         ".github/scripts/smoke_print3d.sh", ".github/scripts/check_viewer.py"],
        [f"{P3D}/runtime/viewer/vendor/THREE_LICENSE.txt"],
    ),
    # Also run on the oldest supported Python: only when Python code or dependencies change.
    "print3d_py310": (
        [f"{P3D}/runtime/p3d/*", f"{P3D}/runtime/requirements.txt", f"{P3D}/runtime/setup_env.sh",
         f"{P3D}/skills/model/examples/*", ".github/scripts/smoke_print3d.sh"],
        [],
    ),
    # Open the generated viewers in headless Chromium.
    "print3d_viewer": (
        [f"{P3D}/runtime/viewer/*", f"{P3D}/runtime/p3d/*", f"{P3D}/skills/model/examples/*",
         ".github/scripts/check_viewer.py"],
        [f"{P3D}/runtime/viewer/vendor/THREE_LICENSE.txt"],
    ),
}

RUN_ALL = [".github/workflows/ci.yml", ".github/scripts/changed_areas.py"]


def matches(path: str, patterns: list[str]) -> bool:
    return any(fnmatchcase(path, p) for p in patterns)


def classify(files: list[str], run_all: bool) -> tuple[dict[str, bool], dict[str, list[str]]]:
    reasons: dict[str, list[str]] = {a: [] for a in AREAS}
    if not run_all:
        run_all = any(f in RUN_ALL for f in files)
    for f in files:
        for area, (inc, exc) in AREAS.items():
            if matches(f, inc) and not matches(f, exc):
                reasons[area].append(f)
    result = {a: run_all or bool(reasons[a]) for a in AREAS}
    return result, reasons


def main(argv: list[str]) -> int:
    run_all = "--all" in argv
    files = [] if run_all else [line.strip() for line in sys.stdin if line.strip()]
    result, reasons = classify(files, run_all)
    # print3d_py310 and print3d_viewer patterns are subsets of print3d_smoke, so 3.13 always runs with them.
    pythons = (["3.10"] if result["print3d_py310"] else []) + (["3.13"] if result["print3d_smoke"] else [])
    for area, on in result.items():
        print(f"{area}={'true' if on else 'false'}")
    print(f"smoke_pythons={json.dumps(pythons)}")

    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            why = "all checks (manual or scheduled run, CI change, or no base to compare)" if run_all or any(
                f in RUN_ALL for f in files) else f"{len(files)} changed file(s)"
            fh.write(f"### Checks selected from {why}\n\n| Check | Runs | Triggered by |\n|---|---|---|\n")
            for area, on in result.items():
                hit = reasons[area]
                shown = ", ".join(f"`{f}`" for f in hit[:5]) + (f" and {len(hit) - 5} more" if len(hit) > 5 else "")
                fh.write(f"| {area} | {'yes' if on else 'skipped'} | {shown} |\n")
            fh.write(f"\nprint3d end-to-end Python versions: {', '.join(pythons) or 'none'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
