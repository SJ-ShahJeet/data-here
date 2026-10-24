"""MCP server: the tools the TrueFoundry agent calls. Bright Data feeds them, FalkorDB answers them."""

from pathlib import Path

from mcp.server.mcpserver import MCPServer  # mcp 2.x name for FastMCP

from datahere import graph, mailer, pipeline
from datahere.schema import SellerProfile

mcp = MCPServer(
    "data-here",
    instructions=(
        "Find who to reach out to at an event and why. Typical flow: run_pipeline, rank_prospects, "
        "explain_prospect, draft_outreach, show the draft to the human, then send_email only after "
        "they explicitly approve that exact email."
    ),
)

_sellers: dict[str, SellerProfile] = {}


def _seller(url: str) -> SellerProfile:
    if url not in _sellers:
        _sellers[url] = pipeline.profile_seller(url)
        graph.upsert_seller(_sellers[url])
    return _sellers[url]


@mcp.tool()
def profile_seller(url: str) -> dict:
    """Profile the seller (your company) from its website: what it sells, its ideal customer profile
    (segments, buyer roles, pain topics, disqualifiers) and known customers. Saves it to the graph.
    Call this first with your company's URL."""
    _sellers.pop(url, None)
    return _seller(url).model_dump()


@mcp.tool()
def import_attendees(sheet_path: str, event: str) -> dict:
    """Read an attendee sheet (.csv or .xlsx with Name / Role / Company columns) for an event.
    Returns how many attendees and distinct companies it contains. Does not enrich or rank."""
    attendees = pipeline.load_sheet(Path(sheet_path))
    return {"attendees": len(attendees), "companies": len({a.company.strip().lower() for a in attendees})}


@mcp.tool()
def run_pipeline(seller_url: str, sheet_path: str, event: str, deep: int = 30) -> dict:
    """Full batch: profile the seller, triage every attendee company, enrich people at the top `deep`
    operator companies (LinkedIn profile + recent posts via Bright Data), and write it all to the graph.
    Slow (minutes). Returns stats. Run once per event before rank_prospects."""
    stats = pipeline.run(seller_url, Path(sheet_path), event, deep)
    _sellers.pop(seller_url, None)  # pipeline re-profiled; refetch lazily
    return stats


@mcp.tool()
def rank_prospects(seller_url: str, event: str, limit: int = 10) -> list[dict]:
    """Ranked list of who to talk to at the event. Each match has a score and reasons (fit, intent,
    lookalike, warmth) with the graph path behind each, plus warm_intro (who can introduce you) and
    hook (best recent signal to open with). Requires run_pipeline first."""
    return [m.model_dump() for m in graph.rank(seller_url, event, limit)]


@mcp.tool()
def explain_prospect(person_id: str, seller_url: str) -> list[dict]:
    """Why this person: every scoring reason with points, a human sentence and its graph path.
    Use the person_id from rank_prospects."""
    return [r.model_dump() for r in graph.explain(person_id, seller_url)]


@mcp.tool()
def remember(note_text: str) -> list[str]:
    """Save something the human tells you about a person, in plain English, e.g.
    'Met Sam Lee from Acme at Tech Week. She knows Priya and can help with fundraising.'
    Adds relationship edges that boost warmth in ranking. Returns the edges written."""
    return graph.remember(pipeline.parse_note(note_text))


@mcp.tool()
def draft_outreach(person_id: str, seller_url: str, event: str) -> dict:
    """Draft a short personalized email to one ranked prospect, opening with their hook.
    Returns {subject, body, to} where `to` is their email or "" if unknown.
    This does NOT send. Show the draft to the human for approval."""
    match = next((m for m in graph.rank(seller_url, event, limit=1000) if m.person_id == person_id), None)
    if match is None:
        raise ValueError(f"{person_id} is not a ranked prospect for {event}; call rank_prospects first")
    draft = pipeline.draft_email(match, _seller(seller_url))
    # ponytail: Match carries no email; enrich_person may fill it later. "" until then.
    return {"subject": draft["subject"], "body": draft["body"], "to": getattr(match, "email", "") or ""}


@mcp.tool()
def send_email(to: str, subject: str, body: str, approved: bool = False) -> dict:
    """Send one email. Only call after the human explicitly approved this exact email.
    Set approved=True only when they did; otherwise the email is refused and nothing is sent."""
    if approved is not True:
        return {"sent": False, "error": "Refused: the human has not approved this exact email."}
    mailer.send(to, subject, body)
    return {"sent": True, "to": to}


@mcp.tool()
def graph_stats() -> dict:
    """Counts of nodes per label in the graph (people, companies, signals, ...)."""
    return graph.stats()


def serve(http: bool = False, port: int = 8000, host: str = "0.0.0.0", sse: bool = False) -> None:
    """stdio by default; --http serves streamable HTTP at /mcp (or SSE at /sse) for TrueFoundry."""
    if not (http or sse):
        mcp.run()
    else:
        mcp.run("sse" if sse else "streamable-http", host=host, port=port)


if __name__ == "__main__":
    serve()
