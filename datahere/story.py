"""Story mode: freeze one finished run into story.json, which the story-mode page (app.py) steps through.

Output goes to data/story/ (gitignored): it holds real attendee names, shortened for the projector.
"""

import json
from pathlib import Path

from datahere import graph, pipeline
from datahere.schema import Note

def _short(name: str) -> str:
    """'Shelby Shipley' -> 'Shelby S.' (stage privacy)."""
    parts = name.split()
    return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else name


def _card(m) -> dict:
    return {
        "name": _short(m.name), "title": m.title, "company": m.company, "score": m.score,
        "warm_intro": _short(m.warm_intro) if m.warm_intro and m.warm_intro != "you" else m.warm_intro,
        "hook": m.hook,
        "reasons": [{"factor": r.factor, "points": r.points, "text": r.text.replace(m.name, _short(m.name)),
                     "path": [_short(p) if p == m.name else p for p in r.path]} for r in m.reasons],
    }


def build(seller_url: str, event: str, out: Path, top: int = 10, note_person: str = "Sam",
          note_place: str = "Tech Week") -> Path:
    seller = pipeline.profile_seller(seller_url)  # cached
    kinds = dict(graph._q("MATCH (:Event {name: $e})<-[:ATTENDS]-(:Person)-[:WORKS_AT]->(c:Company) "
                          "RETURN coalesce(c.kind, 'other'), count(DISTINCT c)", e=event))
    people = graph._q("MATCH (p:Person)-[:ATTENDS]->(:Event {name: $e}) RETURN count(p)", e=event)[0][0]
    signals = graph._q("MATCH (s:Signal) RETURN count(s)")[0][0]
    before = graph.rank(seller_url, event, limit=top)
    companies = [{"name": n, "domain": d or "", "kind": k or "other"} for n, d, k in graph._q(
        "MATCH (:Event {name: $e})<-[:ATTENDS]-(:Person)-[:WORKS_AT]->(c:Company) "
        "RETURN DISTINCT c.name, c.domain, c.kind ORDER BY c.name", e=event)]
    domains = {c["name"]: c["domain"] for c in companies}

    # Memory beat: a note about someone you know who knows a mid-list prospect, then re-rank.
    # Written to the graph only for the snapshot, then removed, so the live demo starts clean.
    target = before[min(4, len(before) - 1)]
    note = Note(person=note_person, met_at=note_place, knows=[target.name])
    edges = graph.remember(note)
    after = graph.rank(seller_url, event, limit=top)
    graph._q("MATCH (p:Person) WHERE p.name = $n AND NOT (p)-[:ATTENDS]->() DETACH DELETE p", n=note_person)

    first = before[0]
    email = pipeline.draft_email(first, seller)  # cached after the first build
    story = {
        "event": event,
        "seller": {"name": seller.name, "url": seller.url, "summary": seller.summary,
                   "icp": seller.icp.model_dump(), "customers": seller.customers},
        "room": {"people": people, "companies": sum(kinds.values()), "kinds": kinds, "signals": signals},
        "companies": companies,  # company names only: no attendee names in bulk
        "top": [_card(m) | {"domain": domains.get(m.company, "")} for m in before],
        "memory": {"note": f"Met {note_person} at {note_place}. {note_person} knows {_short(target.name).rstrip('.')}.",
                   "edges": [e.replace(target.name, _short(target.name)) for e in edges],
                   "target": _short(target.name),
                   "rank_before": next(i for i, m in enumerate(before, 1) if m.person_id == target.person_id),
                   "rank_after": next((i for i, m in enumerate(after, 1) if m.person_id == target.person_id), None),
                   "top_after": [_card(m) | {"domain": domains.get(m.company, "")} for m in after[:5]]},
        "email": {"to": _short(first.name), "subject": email["subject"],
                  "body": email["body"].replace(first.name, _short(first.name))},
    }
    out.mkdir(parents=True, exist_ok=True)
    (out / "story.json").write_text(json.dumps(story, indent=1))
    return out

