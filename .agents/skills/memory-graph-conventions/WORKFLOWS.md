# Workflows: memory-graph toolkit

Step-by-step procedures for common development tasks.

## Adding a hook

When introducing a new `.memory-graph/engine/` script:

1. Read `session-end.sh` or `session-start.sh` to see where it fits in the pipeline.
2. Create the hook under `.memory-graph/engine/<name>.py` or `.sh`.
3. If it needs config: add keys to `mg_config.py` `DEFAULTS` + profile presets + `config.example.yaml`.
4. Add `chmod +x` entry in `setup` (both inplace and remote copy blocks).
5. Write tests in `tests/test_<name>.py` using `sandbox_repo()` and `load_hook()`.
6. Run `bash .memory-graph/scripts/test.sh` — all green before commit.
7. Update `memory-graph-hooks` skill if the pipeline order or contracts changed.
8. Mirror changes to `memory-graph/` if that subfolder is the toolkit source for upgrades.

## Adding a config key

1. Add default to `DEFAULTS` in `mg_config.py`.
2. Add to relevant `PROFILE_PRESETS` if profile-specific.
3. Document in `.memory-graph/config.example.yaml` with a comment.
4. Add test case in `tests/test_mg_config.py`.
5. Wire the key in the hook that consumes it via `load_config()`.
6. Update `memory-graph-hooks` or `memory-graph-conventions` skill if non-obvious.

## Adding a team knowledge skill

1. Create `.agents/skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`, `version`).
2. Add row to `AGENTS.md` skill index table.
3. Add `<name>` to the `for skill in ...` loop in `setup`.
4. If the skill has workflows, add `WORKFLOWS.md` in the same directory.
5. Cross-link from `memory-graph-conventions` → **See also** if domain-related.

## Shipping a feature (end-to-end)

Use the `ship-feature` skill — do not improvise the wave loop.

1. Wave 0: grill with user (one question at a time).
2. Wave 1: research subagent.
3. Wave 1.5: parent slices into independent change sets.
4. Per slice: test agent → apply tests → code agent → validate ∥ guard → review.
5. Commit per slice; `post-commit.sh` runs graphify + compress.
6. Wave 6: update session memory (`context:`, `open:` in today's `.memory-graph/sessions/*.md`).
7. If patterns changed: update the relevant skill in the same PR (`AGENTS.md` rule).

## Upgrading a consumer repo

When refreshing hooks/scripts/skills in an installed project:

```sh
cd /consumer/project
bash .memory-graph/scripts/upgrade-memory-graph.sh
# or first time:
MEMORY_GRAPH_SOURCE=/path/to/memory-graph bash .memory-graph/scripts/upgrade-memory-graph.sh
```

Preserves: `.memory-graph/memory/`, `.memory-graph/sessions/`, live `.memory-graph/config.yaml`, `.cursor/rules/`.

## Pre-push checklist (toolkit development)

```sh
bash .memory-graph/scripts/test.sh
bash .memory-graph/scripts/test-static.sh
graphify update .    # if code files changed
```

If `.memory-graph/scripts/install-dev-hooks.sh` is active, `git push` runs tests automatically.
