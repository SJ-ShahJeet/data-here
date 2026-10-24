---
name: memory-graph-testing
description: Use when adding or editing tests under tests/. Covers sandbox_repo(), load_hook(), fixtures, and the no-network/no-LLM test contract.
version: 1.0.0
---

# memory-graph testing

Apply this skill when the change touches `tests/` or hook test contracts.

## Ground rules

- **No network.** Tests must pass offline.
- **No LLM.** Never call Ollama or Cursor APIs in tests.
- **Sandbox only.** Every test that touches hooks uses `sandbox_repo()` — never the real repo.
- **Fast by default.** Prefer unit tests over integration; full suite via `bash .memory-graph/scripts/test.sh`.

## Layout

```
tests/
├── helpers.py                    # sandbox_repo(), load_hook(), write_config(), session_md()
├── fixtures/                     # Static YAML/JSON for graph scout etc.
├── test_mg_config.py             # Config loader + profile presets
├── test_compress_memory.py       # Structural compression
├── test_assemble_agent_brief.py  # Brief assembly
├── test_graph_scout_local.py     # Local graph scout
├── test_fill_session_from_transcript.py
├── test_ollama_modules.py        # Ollama modules (mocked HTTP)
└── test_compress_tool_output.py
```

## Core helpers (`tests/helpers.py`)

```python
from helpers import sandbox_repo, load_hook, write_config, session_md

def test_example():
    with sandbox_repo() as root:
        write_config(root, "profile: minimal\nagent_brief: false\n")
        mod = load_hook("compress-memory")
        # exercise mod against root
```

- `sandbox_repo()` — temp dir with `.memory-graph/`, `memory/`, `sessions/`, `REPO_ROOT` set.
  It builds the **pre-consolidation** layout on purpose, so the fallback path stays covered;
  `TestConsolidatedLayout` in `tests/test_adapters.py` covers a one-folder install.
- `load_hook(name)` — import hook module from `.memory-graph/engine/<name>.py` by path.
- `write_config(root, yaml)` — write `.memory-graph/config.yaml`.
- `session_md(...)` — generate session frontmatter for compression tests.

**Rule:** extend `helpers.py` only for patterns used by 3+ test files.

## Test tiers

| Command | What it runs | When |
|---------|--------------|------|
| `bash .memory-graph/scripts/test-static.sh` | Syntax, imports, hook.json contract | Every commit |
| `bash .memory-graph/scripts/test-compress-sandbox.sh` | Compression + hook gates | Hook changes |
| `bash .memory-graph/scripts/test.sh` | Full `pytest tests/` | Before push |

Dev repos: `bash .memory-graph/scripts/install-dev-hooks.sh` blocks push on test failure.

## Writing a new hook test

1. Create `tests/test_<hook_name>.py`.
2. Use `sandbox_repo()` context manager for every test case.
3. Load hook via `load_hook("<name>")` — do not import from package paths.
4. Assert on files written under sandbox root, not stdout.
5. Cover: happy path, missing config, empty input, cap/truncation edges.
6. Run `bash .memory-graph/scripts/test.sh` before committing.

## Fixtures

- Put static graph/YAML under `tests/fixtures/`.
- Reference via `Path(__file__).parent / "fixtures" / "..."`.
- Keep fixtures minimal — one concern per file.

## Dashboard tests

`dashboard/test_scan.py` — scan collectors; separate from hook tests. Same no-network rule.
`dashboard/test_static_ui.py` — static frontend contract: panel ids, renderers, offline rule.
`dashboard/test_wiring.py` — greps that setup, test runners and docs all know `dashboard/` exists.

## See also

- `memory-graph-hooks` — what each hook is supposed to do
- `memory-graph-conventions` — `WORKFLOWS.md` → adding a hook
