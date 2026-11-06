"""Open generated viewer.html files in headless Chromium and check that they start without errors.

    python .github/scripts/check_viewer.py <viewer.html> <expected lang> [<viewer.html> <lang> ...]

For each file: no page errors or console errors, the viewer reaches window.__ready, the UI language
is the expected one, the title and every part from the embedded model are shown, and the
"failed to start" message stays hidden. A screenshot is saved next to each file (<name>.png).
Set CHROMIUM_PATH to use an already installed Chromium instead of Playwright's own.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


def check(page, html: Path, lang: str) -> list[str]:
    problems: list[str] = []
    page.on("pageerror", lambda e: problems.append(f"page error: {e}"))
    page.on("console", lambda m: m.type == "error" and problems.append(f"console error: {m.text}"))
    page.goto(html.resolve().as_uri())
    try:
        page.wait_for_function("window.__ready === true", timeout=20000)
    except Exception:
        problems.append("window.__ready was never set (three.js did not start)")
        return problems
    page.wait_for_timeout(500)
    state = page.evaluate("""() => ({
        lang: document.documentElement.lang,
        title: document.getElementById('title').textContent.trim(),
        modelTitle: window.MODEL && window.MODEL.title,
        parts: (window.MODEL && window.MODEL.parts || []).map(p => p.label),
        tree: document.getElementById('tree').textContent,
        errShown: getComputedStyle(document.getElementById('err')).display !== 'none',
        canvas: !!document.querySelector('#view canvas'),
    })""")
    if state["lang"] != lang:
        problems.append(f"UI language is {state['lang']!r}, expected {lang!r}")
    if not state["modelTitle"] or state["title"] != state["modelTitle"]:
        problems.append(f"title shown as {state['title']!r}, model title is {state['modelTitle']!r}")
    if not state["parts"]:
        problems.append("the embedded model has no parts")
    for label in state["parts"]:
        if label not in state["tree"]:
            problems.append(f"part {label!r} is missing from the parts list")
    if state["errShown"]:
        problems.append("the 'viewer failed to start' message is shown")
    if not state["canvas"]:
        problems.append("no WebGL canvas in #view")
    page.screenshot(path=str(html.with_suffix(".png")))
    print(f"{html.name} [{lang}]: {len(state['parts'])} parts, title {state['title']!r}")
    return problems


def main(argv: list[str]) -> int:
    if len(argv) < 2 or len(argv) % 2:
        print(__doc__)
        return 2
    pairs = [(Path(argv[i]), argv[i + 1]) for i in range(0, len(argv), 2)]
    failed = False
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH") or None)
        for html, lang in pairs:
            page = browser.new_page(viewport={"width": 1280, "height": 800})
            for msg in check(page, html, lang):
                failed = True
                print(f"::error file={html.name}::{msg}")
            page.close()
        browser.close()
    print("viewer check failed" if failed else "viewer check passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
