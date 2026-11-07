# AGENTS.md

Guidance for coding agents and for Codex code review in this repository.
Rules for a single plugin live in that plugin's own `AGENTS.md` (for example `plugins/print3d-modeler/AGENTS.md`); they add to this file and win where they are more specific.

## Project overview

`ishimine-plugins` is a **Claude Code / Cowork plugin marketplace** owned by Tomoki Ishimine. It is not an application: what ships is plugin content that Claude reads and runs on the user's machine.

```
.claude-plugin/marketplace.json   marketplace manifest (lists each plugin, its source path and version)
plugins/<plugin>/                 one directory per plugin
  .claude-plugin/plugin.json      plugin manifest (name, version, description, ...)
  skills/<skill>/SKILL.md         skills (YAML frontmatter + Markdown instructions for Claude)
  agents/<agent>.md               subagent definitions (YAML frontmatter + system prompt)
  runtime/                        code the skills run (print3d-modeler: Python package + HTML viewer)
README.md / README.ja.md          English and Japanese READMEs (root and per plugin)
```

Plugins today:

- `print3d-modeler`: designs 3D models for **FDM printers** through conversation, writes them in Python (build123d), checks them with automatic measurements, two read-only reviewer subagents and an offline 3D viewer, and exports print-ready STL / 3MF.

Users install with `/plugin marketplace add TomokiIshimine/ishimine-plugins` and `/plugin install <plugin>@ishimine-plugins`, so whatever is on `main` reaches users once they update.

## Working conventions

- **Language.** Everything inside a plugin (skills, agents, templates, code, comments, runtime messages) is written in English. Claude talks to the user in the user's language at run time; the plugin text tells it to. READMEs exist in both English (`README.md`) and Japanese (`README.ja.md`).
- **Versions.** A plugin's `version` in `plugins/<plugin>/.claude-plugin/plugin.json` and its entry in `.claude-plugin/marketplace.json` are always the same value. Any user-visible change to a plugin bumps it (semver).
- **Anthropic directory rules.** Each plugin folder must stand on its own, because the directory installs only that folder and shows its README as the listing. Keep README images inside the plugin (`plugins/<plugin>/docs/images/`) and link them with Markdown image syntax, keep `author.name` and `displayName` in one writing system (Latin letters only, no Japanese), and keep the listing icon at `.claude-plugin/icon.png`. Keep every non-image file under 256 KiB and readable (no minified or generated blobs), keep plugin code from reading environment variables or running inline programs (`python -c`, heredocs into an interpreter), and keep agent frontmatter to `name`, `description`, `model`, `color` and `tools` (no `skills:`; agents Read the SKILL.md they need instead): the directory scan holds a version for a human reviewer on any of these.
- **Paths inside plugins.** Skills and agents refer to plugin files through `${CLAUDE_PLUGIN_ROOT}`, never through absolute paths or paths relative to the user's working directory.
- **Mechanical checks** (manifest schema, formatting, lint, `claude plugin validate`) belong in CI, not in review comments.

## Code Review Rules

Codex posts only P0 and P1 findings on GitHub, so these rules describe what is worth a P0/P1 here. Write review comments in Japanese (the maintainer reads Japanese); keep code identifiers, file paths and quoted strings as they are.

A finding is P0/P1 in this repository when it would make a plugin fail to install or load, make a skill or agent behave differently from what its instructions promise, break a contract that another file depends on, or let a user print a model that the plugin claims is printable but is not.

### Marketplace and manifests

- `plugin.json` and the matching `marketplace.json` entry must carry the same `version`, `name` and `source` path. Flag a PR that changes files under `plugins/<plugin>/` in a user-visible way (skills, agents, runtime behavior, viewer) without bumping the version in both places, or that bumps only one of them.
- A plugin's `name` must match its directory name and the `source` path in `marketplace.json` must point to an existing directory. Flag renames that update only one side.

### Skills and agents

- Each `skills/<name>/SKILL.md` must have frontmatter whose `name` equals the directory name and whose `description` says when to use the skill. Flag a missing or mismatched `name`, or a description edit that drops the trigger phrases users rely on.
- A skill or agent that names another skill, agent, file, CLI command or flag must name one that exists. Flag references broken by a rename or removal (for example a skill pointing to a deleted `references/*.md`, or an agent telling Claude to Read a `SKILL.md` that no longer exists).
- Paths to plugin files must go through `${CLAUDE_PLUGIN_ROOT}`. Flag hard-coded absolute paths or paths that assume a particular working directory.
- Subagents whose description says they are read-only must not gain `Write`, `Edit` or similar tools in `tools:`. Flag any widening of an agent's tool list that is not explained in the PR.

### Bilingual documentation

- When a PR changes behavior described in a README, both `README.md` and `README.ja.md` (at the same level) must be updated to say the same thing. Flag a PR where one was updated and the other now describes old behavior. Wording and style differences are not findings.

### Do not flag

- Translation style, tone, or word choice in Markdown, as long as the meaning is correct.
- Generated or vendored files (for example `plugins/print3d-modeler/runtime/viewer/vendor/three-bundle.partNN.js`); review the entry file and `.github/scripts/build_three_bundle.py` instead.
- Formatting, import order, line length and other lint-level issues.
