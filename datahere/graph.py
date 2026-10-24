"""FalkorDB: the people graph, your memory, scoring, and the 'why' paths."""

import functools
import re

from falkordb import FalkorDB

from datahere.config import env
from datahere.schema import CompanyInfo, Match, Note, PersonProfile, Reason, SellerProfile

DISQUALIFY_KINDS = ("vendor", "media", "association", "investor")
DEFAULT_ROLE_KEYWORDS = ("cfo", "vp", "operations", "president", "founder", "owner", "ceo", "marketing")
INTENT_POINTS, INTENT_CAP = 1.5, 4.5


@functools.cache
def _db(url: str) -> FalkorDB:
    return FalkorDB.from_url(url)  # one connection pool per URL, not one per query


def _g():
    # Graph name read per call so tests can point GRAPH_NAME at a scratch graph.
    return _db(env("FALKORDB_URL", "redis://localhost:6379")).select_graph(env("GRAPH_NAME", "datahere"))


def _q(cypher: str, **params) -> list[list]:
    return _g().query(cypher, params).result_set


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _slug(*parts: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", " ".join(parts).lower()).strip("-")


def _write_signal(match: str, rel: str, s, params: dict) -> None:
    _q(
        f"""{match}
        MERGE (s:Signal {{kind: $kind, text: $text, url: $url}}) SET s.date = $date
        MERGE (owner)-[:{rel}]->(s)
        MERGE (t:Topic {{name: $topic}}) MERGE (s)-[:ABOUT]->(t)""",
        kind=s.kind, text=s.text, url=s.url, date=s.date, topic=_norm(s.topic), **params,
    )


def init() -> None:
    """Create indexes. Idempotent."""
    for label, prop in [("Seller", "url"), ("Company", "id"), ("Person", "id"), ("Person", "name"),
                        ("Event", "name"), ("Segment", "name"), ("Role", "name"), ("Topic", "name")]:
        try:
            _q(f"CREATE INDEX FOR (n:{label}) ON (n.{prop})")
        except Exception:
            pass  # already exists


def reset() -> None:
    """Delete the whole graph (dev only)."""
    try:
        _g().delete()
    except Exception:
        pass  # graph did not exist


def upsert_seller(seller: SellerProfile) -> None:
    """(:Seller)-[:TARGETS]->(:Segment|:Role|:Topic), (:Seller)-[:HAS_CUSTOMER]->(:Company)."""
    icp = seller.icp
    _q(
        "MERGE (s:Seller {url: $url}) SET s.name = $name, s.summary = $summary, "
        "s.min_locations = $min, s.max_locations = $max",
        url=seller.url, name=seller.name, summary=seller.summary, min=icp.min_locations, max=icp.max_locations,
    )
    for label, names in [("Segment", icp.segments), ("Role", icp.buyer_roles), ("Topic", icp.pain_topics)]:
        for n in names:
            _q(f"MATCH (s:Seller {{url: $url}}) MERGE (x:{label} {{name: $n}}) MERGE (s)-[:TARGETS]->(x)",
               url=seller.url, n=_norm(n))
    for c in seller.customers:
        _q("MATCH (s:Seller {url: $url}) MERGE (c:Company {id: $id}) ON CREATE SET c.name = $name "
           "MERGE (s)-[:HAS_CUSTOMER]->(c)", url=seller.url, id=_norm(c), name=c.strip())


def upsert_event(name: str) -> None:
    _q("MERGE (:Event {name: $name})", name=name.strip())


def upsert_company(c: CompanyInfo) -> None:
    """(:Company)-[:IS]->(:Segment), kind/locations as props, (:Company)-[:HAS_SIGNAL]->(:Signal)-[:ABOUT]->(:Topic)."""
    cid = _norm(c.name)
    _q(
        "MERGE (c:Company {id: $id}) SET c.name = $name, c.domain = $domain, c.kind = $kind, "
        "c.locations = $locations, c.summary = $summary",
        id=cid, name=c.name.strip(), domain=c.domain, kind=c.kind, locations=c.locations, summary=c.summary,
    )
    if c.segment:
        _q("MATCH (c:Company {id: $id}) MERGE (s:Segment {name: $seg}) MERGE (c)-[:IS]->(s)", id=cid, seg=_norm(c.segment))
    for s in c.signals:
        _write_signal("MATCH (owner:Company {id: $id})", "HAS_SIGNAL", s, {"id": cid})


def upsert_person(p: PersonProfile, event: str) -> str:
    """(:Person)-[:WORKS_AT]->(:Company), (:Person)-[:ATTENDS]->(:Event), (:Person)-[:POSTED]->(:Signal)-[:ABOUT]->(:Topic). Returns person_id."""
    pid = _slug(p.name, p.company)
    _q(
        """MERGE (p:Person {id: $id}) SET p.name = $name, p.title = $title, p.linkedin_url = $li,
           p.headline = $headline, p.email = $email
        MERGE (c:Company {id: $cid}) ON CREATE SET c.name = $company
        MERGE (p)-[:WORKS_AT]->(c)
        MERGE (e:Event {name: $event}) MERGE (p)-[:ATTENDS]->(e)""",
        id=pid, name=p.name.strip(), title=p.title, li=p.linkedin_url, headline=p.headline, email=p.email,
        cid=_norm(p.company), company=p.company.strip(), event=event.strip(),
    )
    for s in p.signals:
        _write_signal("MATCH (owner:Person {id: $id})", "POSTED", s, {"id": pid})
    return pid


def _resolve_person(name: str, company: str = "") -> str:
    """Existing person by case-insensitive name (+company if given), else a new one. Returns id."""
    rows = _q(
        "MATCH (p:Person) WHERE toLower(p.name) = $name "
        "OPTIONAL MATCH (p)-[:WORKS_AT]->(c:Company) "
        "WITH p, c WHERE $cid = '' OR c.id = $cid RETURN p.id LIMIT 1",
        name=_norm(name), cid=_norm(company),
    )
    if rows:
        return rows[0][0]
    pid = _slug(name, company)
    _q("MERGE (p:Person {id: $id}) ON CREATE SET p.name = $name", id=pid, name=name.strip())
    if company:
        _q("MATCH (p:Person {id: $id}) MERGE (c:Company {id: $cid}) ON CREATE SET c.name = $company "
           "MERGE (p)-[:WORKS_AT]->(c)", id=pid, cid=_norm(company), company=company.strip())
    return pid


def remember(note: Note) -> list[str]:
    """(:Me)-[:KNOWS {met_at}]->(:Person), (:Person)-[:CAN_HELP_WITH]->(:Topic), (:Person)-[:KNOWS]->(:Person). Returns edges written, human-readable."""
    pid = _resolve_person(note.person, note.company)
    _q("MERGE (m:Me) WITH m MATCH (p:Person {id: $id}) MERGE (m)-[k:KNOWS]->(p) SET k.met_at = $met_at",
       id=pid, met_at=note.met_at)
    edges = [f"Me -KNOWS-> {note.person}" + (f" (met at {note.met_at})" if note.met_at else "")]
    for t in note.can_help_with:
        _q("MATCH (p:Person {id: $id}) MERGE (t:Topic {name: $t}) MERGE (p)-[:CAN_HELP_WITH]->(t)", id=pid, t=_norm(t))
        edges.append(f"{note.person} -CAN_HELP_WITH-> {_norm(t)}")
    for other in note.knows:
        oid = _resolve_person(other)
        _q("MATCH (a:Person {id: $a}), (b:Person {id: $b}) MERGE (a)-[:KNOWS]->(b)", a=pid, b=oid)
        edges.append(f"{note.person} -KNOWS-> {other}")
    return edges


ABBREV = {"cfo": "chief financial officer", "cmo": "chief marketing officer", "coo": "chief operating officer",
          "ceo": "chief executive officer", "cto": "chief technology officer", "svp": "vp", "evp": "vp", "ops": "operations",
          # same function, different word form
          "operating": "operations", "operational": "operations", "finance": "financial", "culinary": "culinary"}
# words that say seniority, not function: "director" alone must not match every director
GENERIC = {"of", "and", "the", "&", "chief", "officer", "director", "head", "senior", "vp", "president",
           "executive", "manager", "lead", "global", "regional", "sr", "sr."}


def _words(s: str) -> set[str]:
    out = set()
    s = re.sub(r"vice[\s-]+president", "vp", (s or "").lower())  # 'vice president' is not 'president'
    for w in re.split(r"[^a-z&.]+", s):
        out.update(ABBREV.get(w, w).split())
    return out - {""}


def _role_hit(title: str, roles: set[str]) -> str | None:
    """A buyer role matches when the title shares its function words (operations, marketing, finance...),
    or, for pure-seniority roles like 'president' / 'founder' / 'owner', the title contains them."""
    t = _words(title)
    # roles naming a function (operations, marketing) before pure-seniority ones (president, owner)
    for role in sorted(roles or DEFAULT_ROLE_KEYWORDS, key=lambda r: (not (_words(r) - GENERIC), r)):
        r = _words(role)
        func = r - GENERIC
        if (func and func <= t) or (not func and r & t):
            return role
    return None


def _seller(seller_url: str) -> dict:
    rows = _q(
        """MATCH (s:Seller {url: $url})
        OPTIONAL MATCH (s)-[:TARGETS]->(x)
        RETURN s.name, s.min_locations, s.max_locations, labels(x)[0], x.name""",
        url=seller_url,
    )
    if not rows:
        raise ValueError(f"unknown seller {seller_url}")
    out = {"name": rows[0][0], "min": rows[0][1], "max": rows[0][2], "Segment": set(), "Role": set(), "Topic": set()}
    for *_, label, name in rows:
        if label:
            out[label].add(name)
    return out


def _score(pid: str, seller_url: str, seller: dict) -> tuple[bool, list[Reason], str | None, str | None]:
    """Returns (disqualified, reasons, warm_intro, hook) for one person."""
    row = _q(
        """MATCH (p:Person {id: $id})
        OPTIONAL MATCH (p)-[:WORKS_AT]->(c:Company)
        OPTIONAL MATCH (c)-[:IS]->(seg:Segment)
        RETURN p.name, p.title, c.name, c.kind, c.locations, collect(seg.name)""",
        id=pid,
    )[0]
    name, title, company, kind, locations, segments = row
    if kind in DISQUALIFY_KINDS:
        return True, [], None, None
    reasons: list[Reason] = []
    comp = company or "?"

    # fit
    if kind == "operator":
        reasons.append(Reason(factor="fit", points=2, text=f"{comp} is an operator",
                              path=[name, "WORKS_AT", comp]))
    for seg in segments:
        if seg in seller["Segment"]:
            reasons.append(Reason(factor="fit", points=2, text=f"{comp} is {seg}, a target segment",
                                  path=[name, "WORKS_AT", comp, "IS", seg, "TARGETED_BY", seller["name"]]))
    lo, hi = seller["min"], seller["max"]
    if locations is not None and (lo is not None or hi is not None) \
            and (lo is None or locations >= lo) and (hi is None or locations <= hi):
        reasons.append(Reason(factor="fit", points=1, text=f"{locations} locations, inside ICP range",
                              path=[name, "WORKS_AT", comp]))
    hit = _role_hit(title, seller["Role"])
    if hit:
        reasons.append(Reason(factor="fit", points=2, text=f"title '{title}' matches buyer role '{hit}'",
                              path=[name, "HAS_ROLE", hit]))

    # intent: person posts first, then company signals
    sigs = _q(
        "MATCH (:Person {id: $id})-[:POSTED]->(s:Signal)-[:ABOUT]->(t:Topic) RETURN 0, s.kind, s.text, s.date, t.name",
        id=pid,
    ) + _q(
        "MATCH (:Person {id: $id})-[:WORKS_AT]->(:Company)-[:HAS_SIGNAL]->(s:Signal)-[:ABOUT]->(t:Topic) "
        "RETURN 1, s.kind, s.text, s.date, t.name",
        id=pid,
    )
    sigs.sort(key=lambda s: s[3] or "", reverse=True)  # newest first
    sigs.sort(key=lambda s: (s[0], s[4] not in seller["Topic"]))  # stable: person posts, targeted topics first
    intent = 0.0
    for src, skind, text, _, topic in sigs:
        if topic in seller["Topic"] and intent < INTENT_CAP:
            pts = min(INTENT_POINTS, INTENT_CAP - intent)
            intent += pts
            path = [name, "POSTED", skind, "ABOUT", topic] if src == 0 else \
                [name, "WORKS_AT", comp, "HAS_SIGNAL", skind, "ABOUT", topic]
            who = name if src == 0 else comp
            reasons.append(Reason(factor="intent", points=pts, text=f"{who} {skind} about {topic}: {text[:120]}", path=path))
    hook = sigs[0][2] if sigs else None

    # lookalike
    for cust, seg in _q(
        """MATCH (p:Person {id: $id})-[:WORKS_AT]->(c:Company)-[:IS]->(seg:Segment)<-[:IS]-(cu:Company)
              <-[:HAS_CUSTOMER]-(:Seller {url: $url})
        WHERE cu <> c RETURN cu.name, seg.name LIMIT 1""",
        id=pid, url=seller_url,
    ):
        reasons.append(Reason(factor="lookalike", points=1, text=f"same segment ({seg}) as your customer {cust}",
                              path=[comp, "IS", seg, "IS", cust, "HAS_CUSTOMER", seller["name"]]))

    # warmth
    warm = None
    if _q("MATCH (:Me)-[:KNOWS]->(p:Person {id: $id}) RETURN 1 LIMIT 1", id=pid):
        warm = "you"
        reasons.append(Reason(factor="warmth", points=3, text=f"you already know {name}", path=["Me", "KNOWS", name]))
    else:
        rows = _q(
            """MATCH (:Me)-[:KNOWS]->(f:Person), (p:Person {id: $id})
            WHERE f <> p AND ((f)-[:KNOWS]-(p) OR (f)-[:WORKS_AT]->(:Company)<-[:WORKS_AT]-(p))
            RETURN f.name, (f)-[:KNOWS]-(p) LIMIT 1""",
            id=pid,
        )
        if rows:
            warm, knows = rows[0][0], rows[0][1]
            path = ["Me", "KNOWS", warm, "KNOWS", name] if knows else ["Me", "KNOWS", warm, "WORKS_AT", comp]
            reasons.append(Reason(factor="warmth", points=2, text=f"{warm} can introduce you", path=path))
    return False, reasons, warm, hook


def rank(seller_url: str, event: str, limit: int = 10) -> list[Match]:
    """Score every attendee: fit + intent + lookalike + warmth, minus disqualified. Reasons = the edges that scored."""
    seller = _seller(seller_url)
    matches = []
    for pid, name, title, company, email in _q(
        "MATCH (p:Person)-[:ATTENDS]->(:Event {name: $event}) OPTIONAL MATCH (p)-[:WORKS_AT]->(c:Company) "
        "RETURN p.id, p.name, p.title, c.name, p.email",
        event=event.strip(),
    ):
        dq, reasons, warm, hook = _score(pid, seller_url, seller)
        if dq:
            continue
        matches.append(Match(person_id=pid, name=name, title=title or "", company=company or "", email=email or "",
                             score=sum(r.points for r in reasons), reasons=reasons, warm_intro=warm, hook=hook))
    matches.sort(key=lambda m: (-m.score, m.name))
    return matches[:limit]


def explain(person_id: str, seller_url: str) -> list[Reason]:
    """All scoring paths for one person."""
    return _score(person_id, seller_url, _seller(seller_url))[1]


def stats() -> dict:
    """Counts per label, for the demo and the deck."""
    try:
        return {label: n for label, n in _q("MATCH (n) RETURN labels(n)[0], count(n)")}
    except Exception:
        return {}  # empty / missing graph
