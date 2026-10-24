---
name: memory-graph-conventions
description: Conventions for the memory-graph toolkit (host-neutral engine, per-agent adapters for Claude Code/Cursor/Copilot, bash scripts, sandbox tests). Apply when editing .memory-graph/engine/, .memory-graph/adapters/, .claude/, .cursor/, .github/hooks/, scripts/, tests/, or docs/ in this repo.
version: 1.2.0
---

# memory-graph toolkit

Persistent agent memory for Claude Code, Cursor, and GitHub Copilot — session hooks,
tiered compression, in-repo code graph, and an optional Ollama gateway. Apply this
skill whenever the change touches toolkit code (not consumer-repo app logic).

## Layout

```
.memory-graph/
├── engine/                   # ALL logic. Host-neutral — must never name an agent.
│   ├── session-end.sh        # Main pipeline — session, compress, graph rebuild
│   ├── session-start.sh      # Agent brief / Ollama context inject
│   ├── tool-output.sh        # postToolUse entrypoint
│   ├── track-file.sh         # Records one edited file into the change ledger
│   ├── compress-memory.py    # Structural compression → .memory-graph/memory/state.yaml
│   ├── compress-tool-output.py
│   ├── assemble-agent-brief.py
│   ├── mg_config.py          # Config loader + HOSTS and layout registries
│   ├── mg_paths.sh           # Shell mirror of the layout registry
│   ├── graph-scout-local.py
│   ├── graph-summary-main.py
│   ├── ollama-context-gateway.py
│   ├── fill-session-from-transcript.py
│   └── semantic-compress-ollama.py
├── adapters/                 # Translators ONLY. No logic lives here.
│   ├── lib.sh                # Shared JSON in/out helpers
│   ├── claude/{session-start,session-end,tool-output,track-file}.sh
│   ├── cursor/{...same four...}.sh
│   └── copilot/{...same four...}.sh
├── config.yaml               # Live config (gitignored in consumer repos)
├── config.example.yaml       # Committed template
├── memory/                   # Living state (hooks write; agents read the brief only)
├── sessions/                 # Daily session files
├── memory.md                 # Session index — beside sessions/, links are relative
├── graphify-out/             # Auto-generated graph — never hand-edit
├── scripts/
│   ├── enable-*.sh           # Feature enablers
│   ├── upgrade-memory-graph.sh   # Refresh hooks; --migrate-layout moves an old repo
│   ├── dashboard.sh
│   └── test*.sh              # Test runners
├── dashboard/                # Read-only Next.js dashboard (never writes)
└── post-commit.sh            # Graph rebuild on commit

# Outside .memory-graph/ only because each host reads these from a fixed path:
.claude/settings.json         # Claude Code hooks (merged into the user's file)
.cursor/
├── hooks.json                # Cursor hooks → cursor adapters
└── rules/
    ├── main.mdc              # Always-on compass (Working On + Codebase summary)
    └── sdlc.mdc              # Opt-in workflow router → ship-feature
.github/
├── hooks/memory-graph.json   # Copilot hooks → copilot adapters
└── copilot-instructions.md   # Always-on context for Copilot
CLAUDE.md                     # Always-on context for Claude Code
AGENTS.md                     # Skill maintenance contract
.agents/skills/               # Team knowledge (this file + siblings)
.gitignore                    # git only reads it from the repo root

# Toolkit repo only (not installed into a consumer repo):
tests/                        # Sandbox unit tests (no network, no LLM)
tests/helpers.py              # sandbox_repo(), load_hook(), write_config()
tests/test_adapters.py        # Runs every agent through the REAL engine
docs/cheat-sheet.md           # Ops reference
site/                         # Landing page + docs (Next.js) and its component library
site/src/                     #   components/{poster,terminal,library,story}, styles/ (tokens), content/story.ts
site/.design-sync/            #   claude.ai/design sync inputs (config, notes, conventions, previews) — see /design-sync
```

**One folder.** Everything memory-graph owns lives under `.memory-graph/` — adopting
it costs a repo one entry, not eight. Never join a data path by hand: ask
`mg_config.memory_dir()` / `sessions_dir()` / `graph_dir()` / `memory_index()` in
Python, `mg_init_paths` in shell, or the same names from `dashboard/lib/mg-config.ts`.
Repos installed before the consolidation keep that data at the root, and the registry
resolves either — one decision per repo, never a mix.

**Key principle:** hooks are the runtime. Scripts enable features. Adapters translate
agent payloads. Tests prove hook contracts in isolated `/tmp` sandboxes. Skills encode
how to change all of these.

## The multi-agent rule

This is the constraint that keeps Claude Code, Cursor, and Copilot at genuine parity
rather than one first-class agent and two that mostly work.

- **The engine never names an agent.** No `.claude/`, `.cursor/`, or `.github/` paths
  in `.memory-graph/engine/`. `.memory-graph/scripts/test-static.sh` fails the build if one appears.
- **`mg_config.py` is the only exception.** It holds the `HOSTS` registry — brief path,
  install marker, and internal directory per agent. Host knowledge lives there or nowhere.
- **Adapters translate and nothing else.** If you are adding behaviour to an adapter,
  it belongs in the engine. `test_adapters.py` fails an adapter that grows past ~60 lines.
- **Agent capabilities differ; handle that in the adapter.** Claude Code
  (`updatedToolOutput`) and Copilot (`modifiedResult`) can replace a tool result;
  Cursor can only append. The engine emits both `replacement` and `context` and lets
  each adapter take what its agent supports.

### Adding a new agent

1. Add an entry to `HOSTS` in `mg_config.py` (brief, marker, internal dirs).
2. Create `.memory-graph/adapters/<agent>/` with all four event scripts.
3. Add the agent's hook manifest and wire it to those scripts.
4. Add the agent to `HOSTS` in `tests/test_adapters.py` and to `setup`.

No engine file should change. If one has to, the neutral contract is wrong — fix the
contract rather than special-casing the agent.

## God nodes (touch with care)

Highest blast radius (identified by in-repo code graph):

| Symbol | Role |
|--------|------|
| `sandbox_repo()` | Test fixture — every hook test depends on it |
| `compress-memory.py` | Structural compression engine |
| `assemble-agent-brief.py` | Session-start brief assembly |
| `mg_config.py` | Single config entry point for all hooks |
| `session-end.sh` | Orchestrates the full stop pipeline |
| `adapters/lib.sh` | Every adapter sources it — breaking it breaks all three agents |

Before editing a god node: run graph scout. See `graph-scout` skill.

## Config system

- **Single loader:** `mg_config.py` — all hooks import `load_config(repo_root)`.
- **Profiles:** `minimal` | `standard` | `token-first` — presets in `PROFILE_PRESETS`.
- **Legacy:** flat `config.yaml` keys and `.memory-graph/ollama.yaml` still work.
- **New keys:** add to `DEFAULTS`, relevant profile preset, `config.example.yaml`, and a test in `test_mg_config.py`.

Never read config ad-hoc in hooks — always go through `mg_config.load_config()`.

## Memory tiers

| Tier | Path | Who writes |
|------|------|------------|
| Brief | `.memory-graph/memory/.agent-brief.yaml` | `assemble-agent-brief.py` (hook) |
| Hot | `.memory-graph/memory/state.yaml` | `compress-memory.py` (hook) |
| Warm | `.memory-graph/sessions/*.md` | `session-end.sh` + transcript fill |
| Cold | `.memory-graph/sessions/archive/` | `compress-memory.py` (daily archive) |
| Index | `.memory-graph/memory.md` | `session-end.sh` |

Agents read `.memory-graph/memory/.agent-brief.yaml` at session start — not `state.yaml` directly
(unless gateway is off).

## Investigate before editing

- Hook change → read `session-end.sh` pipeline order first.
- Config change → read `mg_config.py` + `config.example.yaml`.
- Test change → read `tests/helpers.py` patterns.
- Use `rg` over `find`. Examples:
  - `rg "load_config" .memory-graph/engine/`
  - `rg "sandbox_repo" tests/`

## Build and dev commands

```sh
bash .memory-graph/scripts/test.sh              # full suite (static + unittest + sandbox)
bash .memory-graph/scripts/test-static.sh       # fast syntax/contract checks
bash .memory-graph/scripts/test-compress-sandbox.sh
bash .memory-graph/scripts/upgrade-memory-graph.sh   # refresh hooks from toolkit source
bash .memory-graph/scripts/dashboard.sh           # local read-only dashboard
python3 .memory-graph/engine/graph-build.py .  # build or update code graph
bash .memory-graph/scripts/graph-scout-local.sh "<topic>"    # query code graph locally
```

## Workflows

See `WORKFLOWS.md` in this directory for step-by-step procedures:

- **Adding a hook** — new `.memory-graph/engine/` script + tests + config keys
- **Adding an agent** — HOSTS entry + adapter dir + manifest (see The multi-agent rule)
- **Adding a config key** — mg_config → example → test → docs
- **Adding a skill** — SKILL.md + AGENTS.md index + setup copy list
- **Shipping a feature** — use `ship-feature` skill

## See also

Load these skills when the task ventures into a specific area:

- `memory-graph-hooks` — stop/start pipeline, hook contracts, side effects
- `memory-graph-testing` — sandbox tests, fixtures, no-LLM rule
- `ship-feature` — end-to-end development loop with commit-per-slice
- `graph-scout` — pre-edit graph risk assessment
