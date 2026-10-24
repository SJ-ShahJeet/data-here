#!/usr/bin/env python3
"""memory-graph: durable memory nodes derived from session frontmatter.

Ingests `open` / `blocked` / `facts` items out of session frontmatter into
memory/nodes.json (Open thread / Constraint / Dependency nodes), and decays
unreviewed node weight over time. No LLM, no network.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import os
import re
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path


def _load_mg_config():
    path = Path(__file__).resolve().parent / "mg_config.py"
    spec = importlib.util.spec_from_file_location("mg_config", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


mg = _load_mg_config()

_ALLOWED_SELECT_STATUS = frozenset({"pinned", "confirmed", "unreviewed"})

# open/blocked/facts frontmatter keys -> the node kind they become.
_KIND_BY_KEY = (
    ("open", "Open thread"),
    ("blocked", "Constraint"),
    ("facts", "Dependency"),
)


def _repo_root() -> Path:
    root = os.environ.get("REPO_ROOT")
    if root:
        return Path(root)
    return Path.cwd()


# ── Frontmatter parsing (small pieces copied from compress-memory.py's
# parse_frontmatter/_yaml_list — not imported, since compress-memory.py is a
# hyphenated filename and it in turn imports this module for decay). ────────


def _yaml_list(body: str, key: str) -> list[str]:
    m = re.search(rf"^{key}:\s*\[\]\s*$", body, re.M)
    if m:
        return []

    block = re.search(rf"^{key}:\s*\n((?:  - .+\n?)*)", body, re.M)
    if not block:
        return []

    items = []
    for line in block.group(1).splitlines():
        if not line.strip().startswith("- "):
            continue
        item = line.strip()[2:].strip()
        # One surrounding quote pair, then the \" escapes the writer put inside it.
        if len(item) >= 2 and item[0] == '"' and item[-1] == '"':
            item = item[1:-1]
        items.append(item.replace('\\"', '"'))
    return items


def _parse_session_frontmatter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    data: dict = {"date": "", "open": [], "blocked": [], "facts": []}
    if not text.startswith("---"):
        return data

    parts = text.split("---", 2)
    if len(parts) < 3:
        return data

    fm = parts[1]
    m = re.search(r"^date:\s*(\S+)", fm, re.M)
    if m:
        data["date"] = m.group(1)

    for key in ("open", "blocked", "facts"):
        data[key] = _yaml_list(fm, key)

    return data


def _parse_date(raw) -> date | None:
    if not raw:
        return None
    try:
        return datetime.strptime(str(raw)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


# ── Claim normalisation / node id ────────────────────────────────────────────


def _clean(claim: str) -> str:
    """Claim as displayed: escapes resolved, quotes and whitespace tidied, case kept."""
    s = (claim or "").replace('\\"', '"')
    s = s.strip()
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        s = s[1:-1]
    return re.sub(r"\s+", " ", s).strip()


def normalise(claim: str) -> str:
    """Claim as matched: cleaned, trailing punctuation dropped, lower-cased."""
    return _clean(claim).rstrip(".;,").lower()


def _node_id(normalised_claim: str) -> str:
    return "n-" + hashlib.sha1(normalised_claim.encode("utf-8")).hexdigest()[:10]


# ── Store (memory/nodes.json) ────────────────────────────────────────────────


def _store_path(root) -> Path:
    return mg.memory_dir(Path(root)) / "nodes.json"


def _empty_store() -> dict:
    return {"nodes": [], "ingested_sessions": []}


def load_store(root) -> dict:
    path = _store_path(root)
    if not path.is_file():
        return _empty_store()

    try:
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (OSError, ValueError):
        _quarantine(path)
        return _empty_store()

    if not _valid_store(data):
        _quarantine(path)
        return _empty_store()

    data.setdefault("nodes", [])
    data.setdefault("ingested_sessions", [])
    return data


def _valid_store(data) -> bool:
    if not isinstance(data, dict):
        return False
    nodes = data.get("nodes", [])
    sessions = data.get("ingested_sessions", [])
    return (
        isinstance(nodes, list)
        and all(isinstance(n, dict) for n in nodes)
        and isinstance(sessions, list)
        and all(isinstance(x, str) for x in sessions)
    )


def _quarantine(path: Path) -> None:
    # Keep the unreadable bytes beside the store so nothing is silently lost.
    try:
        os.replace(path, path.parent / (path.name + ".bad"))
    except OSError:
        pass


def save_store(root, store: dict) -> None:
    memory_dir = mg.memory_dir(Path(root))
    memory_dir.mkdir(parents=True, exist_ok=True)
    path = memory_dir / "nodes.json"

    fd, tmp_name = tempfile.mkstemp(prefix=".nodes-", suffix=".json.tmp", dir=str(memory_dir))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(store, fh, indent=2, sort_keys=True)
            fh.write("\n")
        os.replace(tmp_name, path)
    except BaseException:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


# ── Ingest ────────────────────────────────────────────────────────────────────


def ingest(root) -> dict:
    root = Path(root)
    store = load_store(root)
    nodes: list[dict] = store["nodes"]
    ingested_sessions: list[str] = store["ingested_sessions"]
    ingested_set = set(ingested_sessions)
    by_id = {n.get("id"): n for n in nodes}

    sess_dir = mg.sessions_dir(root)
    today_str = date.today().isoformat()

    if sess_dir.is_dir():
        for path in sorted(sess_dir.glob("*.md")):
            name = path.name
            if name in ingested_set:
                continue

            fm = _parse_session_frontmatter(path)
            # An unparsable `date:` falls back to today rather than being stored raw,
            # so every node carries a date decay can read.
            parsed = _parse_date(fm.get("date"))
            session_date = parsed.isoformat() if parsed else today_str

            for key, kind in _KIND_BY_KEY:
                for raw_claim in fm.get(key) or []:
                    key_text = normalise(raw_claim)
                    if not key_text:
                        continue
                    node_id = _node_id(key_text)
                    existing = by_id.get(node_id)
                    if existing is not None:
                        # Same claim seen again: it earns weight; the kind it was
                        # first filed under stays.
                        existing["seen_count"] = existing.get("seen_count", 1) + 1
                        base = min(1.0, float(existing.get("base_weight", existing.get("weight", 0.5))) + 0.1)
                        existing["base_weight"] = round(base, 4)
                        existing["weight"] = existing["base_weight"]
                        existing["last_seen"] = max(existing.get("last_seen", session_date), session_date)
                    else:
                        node = {
                            "id": node_id,
                            "claim": _clean(raw_claim),
                            "kind": kind,
                            "status": "unreviewed",
                            "weight": 0.5,
                            "base_weight": 0.5,
                            "first_seen": session_date,
                            "last_seen": session_date,
                            "seen_count": 1,
                            "source_session": name,
                        }
                        nodes.append(node)
                        by_id[node_id] = node

            ingested_set.add(name)
            ingested_sessions.append(name)

    store["nodes"] = nodes
    store["ingested_sessions"] = ingested_sessions
    save_store(root, store)
    return store


# ── Decay ─────────────────────────────────────────────────────────────────────


def decay(root, today: date | None = None) -> dict:
    root = Path(root)
    if today is None:
        today = date.today()

    cfg = mg.load_config(root)
    half_life = float(cfg.get("decay_half_life_days", 30))

    store = load_store(root)
    if not store.get("nodes"):
        # Nothing to decay; do not create an empty store on repos without one.
        return store
    for node in store.get("nodes", []):
        status = node.get("status")
        weight = float(node.get("weight", 0.5))

        if status == "unreviewed":
            # Decay is a function of time since last_seen, applied to the weight
            # the node earned (base_weight) — never to an already-decayed value,
            # so running decay twice in a day changes nothing.
            base = float(node.get("base_weight", weight))
            node.setdefault("base_weight", round(base, 4))
            last_seen = _parse_date(node.get("last_seen")) or today
            days = max(0, (today - last_seen).days)
            weight = base * (0.5 ** (days / half_life)) if half_life > 0 else base
        elif status == "pinned":
            weight = 1.0
        # confirmed, rejected, and anything else: weight unchanged.

        node["weight"] = round(weight, 4)

    save_store(root, store)
    return store


# ── Select (pure — reads a store, never touches disk) ───────────────────────


def select(store: dict, *, kinds=None, min_weight: float = 0.0, budget_tokens: int | None = None) -> list[dict]:
    candidates = [
        dict(n)
        for n in store.get("nodes", [])
        if n.get("status") in _ALLOWED_SELECT_STATUS
        and (kinds is None or n.get("kind") in kinds)
        and n.get("weight", 0.0) >= min_weight
    ]
    candidates.sort(key=lambda n: (-float(n.get("weight", 0.0)), n.get("claim", "")))

    if budget_tokens is None:
        return candidates

    selected: list[dict] = []
    used = 0
    for n in candidates:
        cost = math.ceil(len(n.get("claim", "")) / 4)
        if used + cost > budget_tokens:
            break
        selected.append(n)
        used += cost
    return selected


# ── CLI ───────────────────────────────────────────────────────────────────────


def main(argv: list[str]) -> int:
    # Hooks must never fail a stop — any error or unknown subcommand exits 0.
    try:
        if not argv:
            return 0
        cmd = argv[0]
        root = _repo_root()
        if cmd == "ingest":
            ingest(root)
        elif cmd == "decay":
            decay(root)
    except Exception:
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
