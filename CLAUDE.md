# data-here

## Working On

<!-- Edit this section: what you are building this week (1–3 sentences). Hooks never overwrite. -->
data-here: a web-scraping agent that writes extractor code instead of paying for LLM
extraction on every page. A human validates the output, the agent opens a PR (Qodo reviews it),
and FalkorDB stores extractors so similar sites reuse them. Built for the WeMakeDevs
"Patch the Conference" hackathon on 2026-10-24. Start with `KICKOFF.md`.


## Codebase

<!-- graph-summary-updated: never -->
Empty so far. Only memory-graph (`.memory-graph/`) and `KICKOFF.md` are here. New code,
with nothing imported from Typed Web or Forkast.


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
