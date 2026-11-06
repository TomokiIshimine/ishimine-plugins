"""Consistency checks for the marketplace and its plugins that `claude plugin validate` does not cover.

    python .github/scripts/check_manifests.py

- Every JSON file in the repository parses.
- Each marketplace entry points at a folder with .claude-plugin/plugin.json, and the plugin's
  name and version there match the marketplace entry.
- Each skill (skills/<dir>/SKILL.md) has front matter with a name equal to <dir> and a description.
- Each agent (agents/*.md) has front matter with a name equal to the file name and a description,
  and every skill it preloads (skills: ["<plugin>:<skill>"]) exists.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
errors: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)
    print(f"ERROR: {msg}")


def rel(p: Path) -> str:
    return str(p.relative_to(ROOT))


def front_matter(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        err(f"{rel(path)}: no front matter (the file must start with ---)")
        return None
    end = text.find("\n---", 4)
    if end < 0:
        err(f"{rel(path)}: front matter is not closed with ---")
        return None
    try:
        data = yaml.safe_load(text[4:end])
    except yaml.YAMLError as e:
        err(f"{rel(path)}: front matter is not valid YAML: {e}")
        return None
    if not isinstance(data, dict):
        err(f"{rel(path)}: front matter is not a mapping")
        return None
    return data


def check_json_files() -> None:
    for p in sorted(ROOT.rglob("*.json")):
        if ".git" in p.parts or "node_modules" in p.parts:
            continue
        try:
            json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            err(f"{rel(p)}: invalid JSON: {e}")


def check_plugin(entry: dict) -> None:
    name = entry.get("name")
    source = entry.get("source")
    if not isinstance(source, str):
        print(f"skip {name}: source is not a local path")
        return
    pdir = (ROOT / source).resolve()
    manifest = pdir / ".claude-plugin" / "plugin.json"
    if not manifest.is_file():
        err(f"marketplace entry {name!r}: {source}/.claude-plugin/plugin.json not found")
        return
    pj = json.loads(manifest.read_text(encoding="utf-8"))
    if pj.get("name") != name:
        err(f"{rel(manifest)}: name {pj.get('name')!r} differs from the marketplace entry {name!r}")
    if "version" in entry and pj.get("version") != entry["version"]:
        err(f"{rel(manifest)}: version {pj.get('version')!r} differs from marketplace.json {entry['version']!r}")

    skills = set()
    for skill_md in sorted(pdir.glob("skills/*/SKILL.md")):
        fm = front_matter(skill_md)
        skills.add(skill_md.parent.name)
        if fm is None:
            continue
        if fm.get("name") != skill_md.parent.name:
            err(f"{rel(skill_md)}: name {fm.get('name')!r} should be the folder name {skill_md.parent.name!r}")
        if not str(fm.get("description") or "").strip():
            err(f"{rel(skill_md)}: description is missing")

    for agent_md in sorted(pdir.glob("agents/*.md")):
        fm = front_matter(agent_md)
        if fm is None:
            continue
        if fm.get("name") != agent_md.stem:
            err(f"{rel(agent_md)}: name {fm.get('name')!r} should be the file name {agent_md.stem!r}")
        if not str(fm.get("description") or "").strip():
            err(f"{rel(agent_md)}: description is missing")
        for ref in fm.get("skills") or []:
            plugin, _, skill = str(ref).rpartition(":")
            if plugin in ("", name) and skill not in skills:
                err(f"{rel(agent_md)}: preloads skill {ref!r}, which does not exist in {name}")

    print(f"ok {name} {pj.get('version')}: {len(skills)} skills, {len(list(pdir.glob('agents/*.md')))} agents")


def main() -> int:
    check_json_files()
    market = ROOT / ".claude-plugin" / "marketplace.json"
    mj = json.loads(market.read_text(encoding="utf-8"))
    names = [p.get("name") for p in mj.get("plugins", [])]
    if len(names) != len(set(names)):
        err("marketplace.json: duplicate plugin names")
    for entry in mj.get("plugins", []):
        check_plugin(entry)
    if errors:
        print(f"\n{len(errors)} problem(s) found")
        return 1
    print("\nAll manifest checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
