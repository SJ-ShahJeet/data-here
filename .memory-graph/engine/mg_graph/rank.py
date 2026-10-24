"""Weighted PageRank-based god node detection with back-recommendation edges."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Mapping

from mg_graph import filters


BACK_EDGE_FACTOR: float = 0.35
GOD_NODE_LIMIT: int = 15
PAGERANK_ALPHA: float = 0.85
MIN_RANKED_FILES: int = 5

RELATION_WEIGHTS: dict[str, float] = {
    "imports": 1.0,
    "calls": 1.0,
    "contains": 0.0,
}

DEFAULT_RELATION: str = "calls"

RISK_BANDS: tuple[tuple[int, str], ...] = (
    (3, "CRITICAL"),
    (8, "HIGH"),
    (15, "MEDIUM"),
)


def _normalize_path(path: str) -> str:
    """Normalize path: backslashes to forward slashes, strip leading './'."""
    normalized = str(path).replace("\\", "/").strip()
    if normalized.startswith("./"):
        normalized = normalized[2:]
    return normalized


def risk_from_rank(rank: int | None) -> str:
    """Map rank position to risk level."""
    if rank is None or rank <= 0:
        return "LOW"
    for threshold, risk in RISK_BANDS:
        if rank <= threshold:
            return risk
    return "LOW"


def load_graph_json(path: Path) -> dict:
    """Load graph JSON from path. Returns empty graph on any error."""
    try:
        text = Path(path).read_text(encoding="utf-8")
        data = json.loads(text)
        if isinstance(data, dict):
            return data
        return {"nodes": [], "links": []}
    except (FileNotFoundError, IsADirectoryError, PermissionError, OSError,
            json.JSONDecodeError, TypeError, ValueError):
        return {"nodes": [], "links": []}


def _endpoint(v: Any) -> str:
    """Extract endpoint identifier from a node or link endpoint."""
    if isinstance(v, dict) and "id" in v:
        return str(v["id"])
    return str(v)


def file_graph(
    graph: Mapping[str, Any], include_excluded: bool = False
) -> tuple[dict[str, dict[str, Any]], dict[tuple[str, str], float]]:
    """Project symbol graph onto files with exclusion, relation weighting, and barrel contraction.

    Returns (files, weights) where:
    - files: {source_file -> {'source_file', 'label', 'id'}}
    - weights: {(src_file, dst_file) -> float}

    `include_excluded` keeps test and generated files in the projection. They
    must never be *reported* as god nodes, but dropping them here also drops
    their outgoing edges, which silently deletes the evidence that a fixture or
    a heavily-tested module matters. `rank_files` keeps them for scoring and
    filters at the end; the default stays exclusion-at-projection.
    """
    # Step 1: Parse nodes and links
    nodes = graph.get("nodes") or []
    links = graph.get("links") or graph.get("edges") or []

    # Step 2 & 4: Build ownership and kind mappings
    owner: dict[str, str] = {}
    kind_by_id: dict[str, str] = {}

    for n in nodes:
        nid = str(n.get("id", ""))
        if not nid:
            continue

        # Normalize source_file or fall back to label
        source_file = n.get("source_file") or n.get("label") or nid
        source_file = _normalize_path(source_file)

        owner[nid] = source_file
        kind_by_id[nid] = str(n.get("kind", "file"))

    # Step 5: Exclude test, generated, and vendored files
    excluded_sources: set[str] = set()
    if not include_excluded:
        for src in set(owner.values()):
            if filters.is_excluded(src):
                excluded_sources.add(src)

    # Remove nodes and mappings for excluded sources
    ids_to_remove = {nid for nid, src in owner.items() if src in excluded_sources}
    for nid in ids_to_remove:
        del owner[nid]
        kind_by_id.pop(nid, None)

    # Step 6: Create file nodes dict
    files: dict[str, dict[str, Any]] = {}
    for src in sorted(set(owner.values())):
        # Find a file-kind node owning this source, or the minimum id
        file_node_id = None
        min_id = None

        for nid, owned_src in owner.items():
            if owned_src == src and kind_by_id.get(nid) == "file":
                file_node_id = nid
                break
            if owned_src == src:
                if min_id is None or nid < min_id:
                    min_id = nid

        use_id = file_node_id or min_id or src
        files[src] = {
            "source_file": src,
            "label": src.rsplit("/", 1)[-1],
            "id": use_id,
        }

    # Step 7: Weight links and build weights map
    weights: dict[tuple[str, str], float] = defaultdict(float)

    for link in links:
        source_ep = link.get("source")
        target_ep = link.get("target")

        u = owner.get(_endpoint(source_ep))
        v = owner.get(_endpoint(target_ep))

        # Skip if either endpoint is missing or was excluded
        if u is None or v is None:
            continue

        # Skip self-loops
        if u == v:
            continue

        # Get relation and base weight
        rel = str(link.get("relation") or DEFAULT_RELATION)
        w = RELATION_WEIGHTS.get(rel, 1.0)

        # Skip zero-weight relations (e.g., 'contains')
        if w == 0.0:
            continue

        # Apply type-only weight to target
        target_kind = kind_by_id.get(_endpoint(target_ep), "")
        w *= filters.type_only_weight(target_kind)

        weights[(u, v)] += w

    # Step 8: Barrel contraction (process in sorted order)
    barrels = sorted(src for src in files if filters.is_barrel(src))

    for barrel in barrels:
        # Collect incoming and outgoing edges
        ins = [(u, w) for (u, v), w in weights.items() if v == barrel and u != barrel]
        outs = [(v, w) for (u, v), w in weights.items() if u == barrel and v != barrel]

        # Redistribute incoming edges to outgoing edges
        if outs:
            for u, wi in ins:
                for v, _ in outs:
                    if u != v:
                        weights[(u, v)] += wi / len(outs)

        # Delete all edges touching the barrel
        keys_to_delete = [
            key for key in weights
            if key[0] == barrel or key[1] == barrel
        ]
        for key in keys_to_delete:
            del weights[key]

        # Remove barrel from files
        files.pop(barrel, None)

    return files, dict(weights)


def rank_files(graph: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Run weighted PageRank with back-recommendation edges over files.

    Returns list of ranked files, each with keys:
    source_file, label, id, score, rank, risk, edges
    """
    # Score over everything, report only what may be a god node. A test is not
    # a god node, but the fact that 97 tests call sandbox_repo() is the whole
    # reason tests/helpers.py is one.
    files, weights = file_graph(graph, include_excluded=True)

    # Build neighbour count
    neighbours: dict[str, set[str]] = defaultdict(set)
    for (u, v) in weights.keys():
        neighbours[u].add(v)
        neighbours[v].add(u)

    edges_count: dict[str, int] = {f: len(neighbours.get(f, ())) for f in files}

    # Find active (connected) files
    active = sorted(f for f in files if edges_count.get(f, 0) > 0)

    # Small-graph fallback
    if len(active) < MIN_RANKED_FILES:
        result = []
        reportable = [f for f in active if not filters.is_excluded(f)]
        for i, source_file in enumerate(sorted(reportable, key=lambda f: (-edges_count.get(f, 0), f))):
            result.append({
                "source_file": source_file,
                "label": files[source_file]["label"],
                "id": files[source_file]["id"],
                "score": float(edges_count.get(source_file, 0)),
                "rank": i + 1,
                "risk": "LOW",
                "edges": edges_count.get(source_file, 0),
            })
        return result

    # PageRank with back-edges
    import networkx

    G = networkx.DiGraph()
    G.add_nodes_from(active)

    # Add edges with back-edge factor
    final_weights: dict[tuple[str, str], float] = dict(weights)
    for (u, v), w in weights.items():
        if u in active and v in active:
            # Add back-edge
            final_weights[(v, u)] = final_weights.get((v, u), 0.0) + w * BACK_EDGE_FACTOR

    # Add edges to graph
    for (u, v), w in final_weights.items():
        if u in active and v in active:
            G.add_edge(u, v, weight=w)

    # Compute PageRank
    scores = networkx.pagerank(
        G, alpha=PAGERANK_ALPHA, weight="weight", max_iter=200, tol=1.0e-08
    )

    # Build result list
    entries = []
    for source_file, score in scores.items():
        if filters.is_excluded(source_file):
            continue
        entries.append({
            "source_file": source_file,
            "label": files[source_file]["label"],
            "id": files[source_file]["id"],
            "score": score,
            "rank": 0,  # Will be assigned after sorting
            "risk": "",  # Will be assigned after sorting
            "edges": edges_count.get(source_file, 0),
        })

    # Sort by score descending, then by source_file ascending
    entries.sort(key=lambda e: (-e["score"], e["source_file"]))

    # Assign ranks and risk
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1
        entry["risk"] = risk_from_rank(entry["rank"])

    return entries


def god_nodes(graph: Mapping[str, Any], limit: int = GOD_NODE_LIMIT) -> list[dict[str, Any]]:
    """Return the top N ranked files (god nodes)."""
    if limit <= 0:
        return []
    ranked = rank_files(graph)
    return ranked[:limit]


def risk_by_file(graph: Mapping[str, Any]) -> dict[str, str]:
    """Return risk level for every ranked file, by source_file."""
    return {entry["source_file"]: entry["risk"] for entry in rank_files(graph)}
