# data-here

## Working On

<!-- Edit this section: what you are building this week (1–3 sentences). Hooks never overwrite. -->
data-here: tells a GTM team who to reach out to at an event, and why. Input = your company URL +
the event's attendee sheet; Bright Data scrapes company sites, search and LinkedIn; FalkorDB scores
fit/intent/lookalike/warmth and stores the "why" paths; a TrueForge (TrueFoundry) agent on OpenAI
drives it over MCP and asks approval before sending email. WeMakeDevs "Patch the Conference"
hackathon, 2026-10-24. `KICKOFF.md` is the original (superseded) idea; README.md is current.
Real attendee data lives only in gitignored `data/`.


## Codebase

<!-- graph-summary-updated: 2026-10-24 -->
Core abstractions (god nodes): `brightdata.py` (5), `config.py` (4), `pipeline.py` (8), `graph.py` (5), `schema.py` (5).


## Where to go

- **Team knowledge:** `AGENTS.md` + `.agents/skills/` (conventions, workflows, maintenance contract)
- **Living state (every session):** `.memory-graph/memory/.agent-brief.yaml`
- **Tier map (read once):** `.memory-graph/memory/README.md`
- **Graph scout:** `.memory-graph/memory/.graph-scout.yaml` (via graph scout — not the graph JSON inline)

## Memory rules

memory-graph maintains this file and the session history under
`.memory-graph/sessions/`. Everything the tool owns lives in `.memory-graph/`.
Two rules matter for keeping context small:

- **Do not read `.memory-graph/graphify-out/graph.json` into the conversation.** It is large.
  Use the `graph-scout` skill, which answers structural questions from the graph
  without loading it.
- **Do not read `.memory-graph/memory/state.yaml` or `.memory-graph/sessions/` when a brief was injected at
  session start.** The `SessionStart` hook already put the relevant slice in
  context; reading the sources again duplicates it.

## Team knowledge (load by domain)

| Area | Skill |
|------|-------|
| Engine, adapters, scripts, layout | `memory-graph-conventions` |
| `.memory-graph/engine/` pipeline | `memory-graph-hooks` |
| `tests/` | `memory-graph-testing` |
| End-to-end feature | `ship-feature` |
