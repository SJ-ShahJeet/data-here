"""Local CLI mirroring the MCP tools: `datahere run|rank|explain|remember|draft|stats|serve`."""

import argparse
import json

from datahere import server


def _print_rank(matches: list[dict]) -> None:
    print(f"{'#':>3}  {'name':<24} {'title':<28} {'company':<24} {'score':>6}")
    for i, m in enumerate(matches, 1):
        print(f"{i:>3}  {m['name'][:24]:<24} {m['title'][:28]:<28} {m['company'][:24]:<24} {m['score']:>6.1f}")
        for r in m["reasons"]:
            print(f"       - [{r['factor']} +{r['points']:g}] {r['text']}")
        if m.get("warm_intro"):
            print(f"       warm intro: {m['warm_intro']}")
        if m.get("hook"):
            print(f"       hook: {m['hook']}")
        print(f"       id: {m['person_id']}")


def main() -> None:
    p = argparse.ArgumentParser(prog="datahere", description="Who to reach out to at an event, and why.")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("run", help="profile seller, triage + enrich attendees, write graph")
    s.add_argument("seller_url")
    s.add_argument("sheet")
    s.add_argument("event")
    s.add_argument("--deep", type=int, default=30)

    s = sub.add_parser("rank", help="ranked prospects with reasons")
    s.add_argument("seller_url")
    s.add_argument("event")
    s.add_argument("--limit", type=int, default=10)

    s = sub.add_parser("explain", help="all scoring paths for one person")
    s.add_argument("person_id")
    s.add_argument("seller_url")

    s = sub.add_parser("remember", help="save a free-text note about someone")
    s.add_argument("note")

    s = sub.add_parser("draft", help="draft an outreach email (does not send)")
    s.add_argument("person_id")
    s.add_argument("seller_url")
    s.add_argument("event")

    sub.add_parser("stats", help="graph counts per label")

    s = sub.add_parser("serve", help="run the MCP server (stdio by default)")
    s.add_argument("--http", action="store_true", help="streamable HTTP at /mcp")
    s.add_argument("--sse", action="store_true", help="SSE at /sse instead")
    s.add_argument("--host", default="0.0.0.0")
    s.add_argument("--port", type=int, default=8000)

    a = p.parse_args()
    match a.cmd:
        case "run":
            out = server.run_pipeline(a.seller_url, a.sheet, a.event, a.deep)
        case "rank":
            return _print_rank(server.rank_prospects(a.seller_url, a.event, a.limit))
        case "explain":
            for r in server.explain_prospect(a.person_id, a.seller_url):
                print(f"[{r['factor']} +{r['points']:g}] {r['text']}\n    {' -> '.join(r['path'])}")
            return
        case "remember":
            out = server.remember(a.note)
        case "draft":
            d = server.draft_outreach(a.person_id, a.seller_url, a.event)
            return print(f"To: {d['to'] or '(unknown)'}\nSubject: {d['subject']}\n\n{d['body']}")
        case "stats":
            out = server.graph_stats()
        case "serve":
            return server.serve(http=a.http, port=a.port, host=a.host, sse=a.sse)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
