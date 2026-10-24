# data-here

Who to reach out to at an event, and why. A GTM team drops in an event attendee sheet and their
company URL. An agent profiles the seller (what it sells, its ideal customer, its customers), sorts
every attendee company (operator, vendor, investor, ...), pulls LinkedIn profiles and recent posts for
the most promising people, and ranks them. Each pick comes with its reasons (fit, intent, lookalike,
warmth) and the graph path behind each one, plus a warm intro and an opening hook. It drafts the
email, and nothing is sent until a human approves that exact email.

## Sponsors

- **TrueFoundry + OpenAI**: the agent runs on TrueFoundry and calls the `data-here` MCP tools. Every
  LLM call goes through the TrueFoundry AI Gateway (`OPENAI_BASE_URL`) to OpenAI.
- **Bright Data**: the data. Web Unlocker fetches company sites, SERP API finds domains and LinkedIn
  URLs, and the Web Scraper API pulls LinkedIn profiles, posts and companies.
- **FalkorDB**: the graph and the "why". People, companies, signals, topics and your own relationships
  are nodes and edges. Ranking scores those paths, and `explain` returns them.

## Setup

```bash
cp .env.example .env      # fill in Bright Data, OpenAI/TrueFoundry, SMTP keys
docker compose up -d      # FalkorDB on :6379, browser at http://localhost:3001
uv sync
```

The FalkorDB browser at http://localhost:3001 shows the graph live.

## Commands

```bash
datahere run https://yourco.com sample/attendees_sample.csv "Event 2026" --deep 30
datahere rank https://yourco.com "Event 2026" --limit 10
datahere explain <person_id> https://yourco.com
datahere remember "Met Sam Lee from Acme at Tech Week. She knows Priya."
datahere draft <person_id> https://yourco.com "Event 2026"
datahere stats
datahere serve                       # MCP over stdio
datahere serve --http --port 8000    # MCP over streamable HTTP at /mcp (--sse for /sse)
```

MCP tools: `profile_seller`, `import_attendees`, `run_pipeline`, `rank_prospects`,
`explain_prospect`, `remember`, `draft_outreach`, `send_email` (refuses unless `approved=true`),
`graph_stats`.

## Register the MCP server with TrueFoundry

1. Run `datahere serve --http --port 8000` (binds `0.0.0.0`; endpoint is `http://<host>:8000/mcp`).
2. Expose it at a public URL (deploy it, or tunnel it, e.g. `ngrok http 8000`).
3. Add it to TrueFoundry as a remote MCP server at `https://<public-url>/mcp`.
4. TODO (after the workshop): the exact TrueFoundry UI steps, auth, and agent config.

## Data

Real attendee data lives only in `data/`, which is gitignored (as are `*.xlsx` and `.env`).
`sample/attendees_sample.csv` is synthetic.

## Test

```bash
.venv/bin/python -m pytest tests/test_server.py -q
```
