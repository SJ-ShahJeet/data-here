# Memory map

One-time orientation for humans and agents. **Each session start:** read only
`.memory-graph/memory/.agent-brief.yaml` (~45 lines).

Everything memory-graph owns lives under `.memory-graph/`. Repos installed
before that consolidation keep these paths at the repo root instead; the engine
reads either.

## Read order

| Tier | Path | What |
|------|------|------|
| **Compass** | `.cursor/rules/main.mdc` | Working On (you edit) + Codebase (graphify/Ollama) |
| **Living** | `.memory-graph/memory/.agent-brief.yaml` | Merged open items, context, god nodes, scout |
| **Hot** | `.memory-graph/memory/state.yaml` | Hook rollup (included in brief) |
| **Warm** | `.memory-graph/sessions/*.md` | Today's sessions (what + why) |
| **Cold** | `.memory-graph/sessions/archive/YYYY-MM.yaml` | Prior days + monthly summary |
| **Index** | `.memory-graph/memory.md` | Last 30 sessions |

## Config

Single file: `.memory-graph/config.yaml`

```yaml
profile: standard   # standard | token-first | minimal
core: { ... }
ollama: { enabled: false, ... }
```

- `profile: token-first` — Ollama gateway on, slim sessionStart injection
- `profile: minimal` — hooks only, no agent brief
- Legacy `ollama.yaml` still works during migration

## What hooks write vs you

| Field | Who |
|-------|-----|
| `main.mdc` → Working On | **You** (1–3 sentences) |
| `main.mdc` → Codebase | **Hook** (graphify + Ollama) |
| `.memory-graph/sessions/*.md` context/why/outcome | **Hook** (transcript fill) + you may refine |
| `.memory-graph/memory/.agent-brief.yaml` | **Hook** (assemble-agent-brief) |

## Setup

```bash
bash setup                              # or plugin: memory-graph-setup skill
/graphify .                             # once — graph + Codebase summary
bash .memory-graph/scripts/enable-semantic-ollama.sh   # optional local Ollama
```

Ops reference → `docs/cheat-sheet.md`
