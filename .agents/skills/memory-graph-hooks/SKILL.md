---
name: memory-graph-hooks
description: Use when editing .memory-graph/engine/, the session stop/start pipeline, or hook side effects (sessions, compression, graph rebuild, Ollama). Covers orchestration order, config access, and contracts.
version: 1.0.0
---

# memory-graph hooks

Apply this skill when the change touches `.memory-graph/engine/` or hook orchestration.

## Stop pipeline (`session-end.sh`)

Runs on every agent stop when project files changed:

1. **Guards** — once per chat, clean completion only
2. **Change detection** — git diff and/or Cursor ledger (`MEMORY_TRACK`: auto|git|cursor)
3. **Smart gate** — skip if <3 files changed and no god-node blast radius
4. **Session file** — `.memory-graph/sessions/YYYY-MM-DD-N.md` with YAML frontmatter
5. **.memory-graph/memory.md index** — append row
6. **graph-build.py** — background AST rebuild when code changed
7. **graph-summary-main.py** — sync god nodes into `main.mdc` ## Codebase
8. **memory_nodes.py ingest** — session `open`/`blocked`/`facts` → `.memory-graph/memory/nodes.json` (runs before compress so decay and the brief see new nodes)
9. **compress-memory.py** — structural rollup → `.memory-graph/memory/state.yaml`, archive, then `memory_nodes.py` decay
10. **assemble-agent-brief.py** — rebuild `.memory-graph/memory/.agent-brief.yaml`
11. **graph-scout-local.py** — precompute scout if `graph_scout_on_stop` enabled
12. **fill-session-from-transcript.py** — fill empty `context:`/`open:` from transcript
13. **semantic-compress-ollama.py** — only when Ollama enabled and caps hit

**Never creates a session for:** pure Q&A, edits under `.cursor/`, `.memory-graph/sessions/`,
`.memory-graph/memory.md`, `.memory-graph/graphify-out/`.

## Start pipeline (`session-start.sh`)

1. If `ollama_context_on_start`: inject distilled context from `.memory-graph/memory/.context.yaml`
2. Else if `agent_brief`: inject `.memory-graph/memory/.agent-brief.yaml` (assembled at stop)

Session start must never block on Ollama network calls >10s — precompute at stop.

## Config access (mandatory)

```python
from mg_config import load_config

cfg = load_config(repo_root)
if cfg.get("agent_brief"):
    ...
```

- Never parse `config.yaml` manually in hooks.
- Never hardcode profile defaults — use `load_config()` which merges profile + overrides.
- `REPO_ROOT` env var is set in tests via `sandbox_repo()`; hooks use `git rev-parse --show-toplevel`.

## Hook contracts

| Hook | Input | Output / side effect |
|------|-------|----------------------|
| `compress-memory.py` | sessions + .memory-graph/memory.md | `.memory-graph/memory/state.yaml`, archive, `.semantic-pending` |
| `memory_nodes.py` | sessions (open/blocked/facts frontmatter) | `.memory-graph/memory/nodes.json` |
| `assemble-agent-brief.py` | state + scout + config | `.memory-graph/memory/.agent-brief.yaml` |
| `graph-scout-local.py` | query string | `.memory-graph/memory/.graph-scout.yaml` |
| `ollama-context-gateway.py` | sessions at stop | `.memory-graph/memory/.context.yaml` |
| `fill-session-from-transcript.py` | transcript + session md | updates frontmatter fields |
| `compress-tool-output.py` | large tool output | truncated summary (postToolUse) |

## Copilot adapters

Copilot hooks live in `.github/hooks/memory-graph.json` and use adapters in `.memory-graph/adapters/`:

| Adapter | Copilot event | What it does |
|---------|---------------|--------------|
| `copilot-session-start.sh` | `sessionStart` | Calls Cursor hook, transforms `additional_context` → `additionalContext` |
| `copilot-session-end.sh` | `sessionEnd` | Translates Copilot payload to Cursor format, calls pipeline |
| `copilot-post-tool.sh` | `postToolUse` | Compresses large tool outputs |

**Adapter contract:**
- Read Copilot JSON from stdin (camelCase: `sessionId`, `transcriptPath`, `toolName`)
- Export `IDE_SOURCE=copilot` for downstream scripts that care
- Call shared Cursor hooks in `.memory-graph/engine/`
- Transform output to Copilot format (camelCase keys)

**Adding a new Copilot hook:**
1. Add event to `.github/hooks/memory-graph.json`
2. Create adapter in `.memory-graph/adapters/copilot-<event>.sh`
3. Adapter reads stdin, calls Cursor hook, transforms output
4. Add test in `tests/test_copilot_adapter.py`

## Error handling

- Hooks exit silently on failure — never block the agent with hook errors.
- Write status to dotfiles (`.memory-graph/memory/.semantic-ollama-status`, etc.) for debugging.
- Bash hooks: `set -uo pipefail` but swallow non-critical failures.

## Adding to the pipeline

- **Stop hook:** append step in `session-end.sh` after compression, before exit.
- **Start hook:** extend `session-start.sh` — keep injection under token budget.
- **Cursor hook registration:** update `.cursor/hooks.json` if adding a new event type.
- **Copilot hook registration:** update `.github/hooks/memory-graph.json` + create adapter.
- Always add a sandbox test proving the hook's contract in isolation.

## Linting / style

- Python hooks: stdlib + minimal deps; shebang `#!/usr/bin/env python3`.
- Bash hooks: `REPO_ROOT` from git toplevel; no `cd` without restoring.
- No LLM calls in hooks unless explicitly gated by config (`enabled: true`).

## See also

- `memory-graph-conventions` — layout and god nodes
- `memory-graph-testing` — how to test hooks
- `semantic-compress` — manual semantic compression skill
