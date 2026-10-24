# data-here: kickoff prompt

Paste everything below the line into a new Claude Code session opened in this folder.

---

You're my build partner for the WeMakeDevs **Patch the Conference** hackathon, happening **today (2026-10-24)**. We're building **data-here**. This repo is brand new: don't import, copy or reference code from Typed Web, Forkast or any other repo of mine. memory-graph is installed here (`.memory-graph/`) for session memory, so leave it alone except for normal use.

## The event (facts from wemakedevs.org/hackathons/ptc and luma.com/ptc)

- **Where:** Bright Data, 625 2nd St, San Francisco. In person, 21+, government photo ID required.
- **Schedule:**
  - 09:00 setup
  - 10:00–11:00 sponsor workshops
  - **11:00–14:00 build**
  - 14:00 lunch
  - **14:00–17:30 finish + submit**
  - 17:30 demos on stage
  - 18:30 winners
- **Teams:** solo or up to 4. **Every track requires a working demo that runs live on stage.**
- **Tracks** (I want to compete in all four with one product):
  1. **FalkorDB** (graph DB): multi-hop queries, memory across sessions, shared agent state, using Cypher and Docker. Judged on: graph at the core, explainable answers.
  2. **Bright Data** (live web data): MCP, SERP API, Web Unlocker, Browser API, Scraper APIs. Judged on: live web data at the core, data quality, usefulness.
  3. **TrueForge + OpenAI** (agent harness): MCP tools, sandbox, skills, **human approvals**, SDK, chat UI. Judged on: built on TrueForge and powered by OpenAI.
  4. **Qodo** (AI code review GitHub app). Judged on: reviews real PRs all day, small clear PRs, fixes shown in the demo, clean repo at the end.
- **Prizes:** cash or an iPhone per track. The two pages list different amounts, so confirm on-site.
- **Theme risk:** the official theme is "fix what's broken about conferences", and the FalkorDB and TrueFoundry criteria mention a conference problem. Bright Data's criteria don't. Confirm with the organizers whether a non-conference product counts.

## The product: data-here

**Problem:**
- LLM extraction on every page is expensive and slow, and the cost grows with every page.
- Hand-written scrapers are cheap to run, but they break silently and cost an engineer to fix.

**Idea:** an agent that **writes the extractor code once**, a human validates it, and from then on it runs with **no model** on the call path. Extractors are stored in a graph, so a new site that looks like a known one reuses an existing extractor instead of generating a new one. The system gets cheaper with every site it sees.

**Flow:**
1. **Input:** a URL plus the target schema (the fields we want).
2. **Fetch** through Bright Data (Web Unlocker or Browser API for blocked or JS-heavy sites). **Fingerprint** the layout (platform, DOM signature).
3. **Graph lookup in FalkorDB:** is there a known extractor that works on a similar layout? If yes, run it with **no LLM**, validate against the schema, and return. This is the fast path.
4. **On a miss:**
   - An OpenAI agent on TrueForge writes the extractor and runs it in the sandbox on a few sample pages.
   - A **human approves** the sample outputs, or rejects them with notes, and the agent retries.
5. **Approved:**
   - The agent opens **one small PR** (`extractors/<site>.py` + a fixture test).
   - **Qodo reviews** it, and the human merges.
   - The extractor is registered in FalkorDB:
     - `(Site)-[:HAS_LAYOUT]->(Layout)<-[:WORKS_ON]-(Extractor)-[:EMITS]->(Field)`
     - `(Run)` nodes for history
6. **Self-heal:** when a run fails schema validation, flag the site and loop back to step 4.

**One product, four tracks:**

| Track | Where it's real |
|---|---|
| Bright Data | Every fetch goes through it. Live web data is the input. |
| TrueForge + OpenAI | The agent that writes and tests code in the sandbox, with the human-approval gate. |
| Qodo | Each new site = one small PR that Qodo reviews all day. |
| FalkorDB | The extractor registry plus layout-similarity reuse, with explainable Cypher paths ("reused X because same platform + DOM match"). |

## Task 1: Pick the demo domain (spend 10 minutes max, use `/grill-me` briefly)

The two candidates:
- **Restaurants:** a scanner-style tool that scans menus and prices across competing restaurants.
  - Upside: many restaurant sites run on shared platforms (Toast, Square, ChowNow, etc.), so **graph reuse is visible on stage**. Site A is generated; site B on the same platform is reused instantly with $0 in LLM cost.
- **Truck rental:** quotes in the style of U-Haul or Penske.
  - Upside: dynamic quote forms show off the Bright Data Browser API.
  - Downside: there are only a few sites, so the reuse story is weak.

My lean is restaurants, but ask me. Whichever we pick, build a **generic** scanner: no Forkast branding, no client names, no client data.

## Task 2: System design doc

Write it as a Claude Doc using the `system-design-doc` skill, and get my agreement **before any code**.

Tabs:
- Overview
- Tech stack
- Flow / state machine
- Graph schema
- Interfaces (CLI, PR format, approval step)
- Demo script
- Open questions

## Task 3: Pitch deck titled "data-here"

Make it an Artifact (slides).

Slides:
1. Title
2. Problem
3. Insight ("write the code once, run it forever")
4. How it works
5. One product, four tracks
6. Demo
7. Graph reuse ("gets cheaper with every site")
8. Measured numbers
9. What's next
10. Team

## Task 4: Scaffold (after the doc is agreed)

- **Stack:** Python 3.12.
  - Libraries: `openai`, `falkordb`, `httpx`, `selectolax`, `pydantic`.
  - The TrueForge SDK gets added after the 10:00 workshop.
  - PRs are opened with the `gh` CLI (logged in as SJ-ShahJeet).
- **Files:**
  - `docker-compose.yml`: FalkorDB only, ports 6379 and 3000 (the browser UI).
  - `.env.example` with `BRIGHTDATA_API_KEY`, `BRIGHTDATA_ZONE`, `OPENAI_API_KEY`, `FALKORDB_URL` and `GITHUB_REPO`.
  - `datahere/` package: `fetch.py`, `fingerprint.py`, `graph.py`, `agent.py`, `pr.py`, `cli.py`.
  - `extractors/` and `fixtures/`.
  - `README.md`.
- **GitHub:** create the repo with `gh` (ask me for the visibility first), then install the Qodo GitHub app.

## Timeline (timeboxed; cut scope, never the demo)

- **11:00–12:30:** fetch + the agent writes and runs one extractor
- **12:30–14:00:** FalkorDB registry + reuse lookup
- **14:00–15:30:** approval step + automatic PR + Qodo
- **15:30–16:30:** self-heal + cached fixtures for an offline demo
- **16:30–17:30:** fill the deck with measured numbers, rehearse, submit

## Questions I need to ask on-site (remind me)

1. Can one project enter all four tracks? Does a non-conference theme count?
2. How do we submit? Must the repo be public, with code written today?
3. How do we claim the Bright Data ($50) and OpenAI credits? How do we get TrueForge access and its docs?
4. Does Qodo need a public repo or a specific setup?
5. How long is a demo slot, and what display connection is there?

## Rules

- **No invented numbers.** Cost and latency on the slides come from runs we measure today.
- **No AI attribution** in commits or PRs (no Co-Authored-By, no "Generated with"). I'm the only author.
- **Always keep a fixtures fallback** so the demo works if the venue Wi-Fi dies.
- Keep things small: the shortest working version first, polish only if there's time.
