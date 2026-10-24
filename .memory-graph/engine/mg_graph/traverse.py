"""In-repo graph traversal — scoring, BFS, and text generation."""

from __future__ import annotations

from typing import Sequence

HUB_DEGREE_FLOOR: int = 50
CHARS_PER_TOKEN: int = 3


def score_nodes(G, terms: Sequence[str]) -> list[tuple[float, str]]:
    """Score nodes by term relevance.

    Returns list of (score, node_id) tuples sorted by (-score, node_id).
    Returns [] when norm_terms is empty.
    """
    # Order-preserving dedup of normalized terms
    norm_terms = []
    seen = set()
    for t in terms:
        normalized = t.strip().casefold()
        if normalized and normalized not in seen:
            norm_terms.append(normalized)
            seen.add(normalized)

    if not norm_terms:
        return []

    results = []
    for nid in G.nodes():
        data = G.nodes[nid]
        label = str(data.get('label', nid))
        source_file = data.get('source_file', '')
        hay = f'{label}\n{nid}\n{source_file}'.casefold()

        # Count substring matches
        matched = sum(1 for term in norm_terms if term in hay)
        if matched == 0:
            continue

        # Score: matched/len(norm_terms) + bonus for exact label match
        score = matched / len(norm_terms)
        if label.casefold() in norm_terms:
            score += 1.0

        results.append((score, nid))

    # Sort by (-score, nid)
    results.sort(key=lambda x: (-x[0], x[1]))
    return results


def bfs(G, start_nodes: Sequence[str], depth: int = 2) -> tuple[set[str], list[tuple[str, str]]]:
    """Breadth-first search from start nodes, respecting hub threshold.

    Returns (visited_nodes, induced_edges).
    - Seeds are always expanded; other nodes with degree >= hub_threshold are visited but not expanded
    - Hubs are determined by max(HUB_DEGREE_FLOOR, p99 of degree distribution)
    """
    # Calculate hub threshold
    if G.number_of_nodes() > 0:
        degrees = [G.degree(n) for n in G.nodes()]
        degrees_sorted = sorted(degrees)
        p99_idx = int(len(degrees_sorted) * 0.99)
        if p99_idx >= len(degrees_sorted):
            p99_idx = len(degrees_sorted) - 1
        p99 = degrees_sorted[p99_idx] if p99_idx >= 0 else 0
        hub_threshold = max(HUB_DEGREE_FLOOR, p99)
    else:
        hub_threshold = HUB_DEGREE_FLOOR

    # Initialize frontier with valid start nodes
    visited = set()
    frontier = []
    for node in start_nodes:
        if node in G.nodes():
            visited.add(node)
            frontier.append(node)

    # BFS for `depth` iterations
    for _ in range(depth):
        next_frontier = []
        for node in frontier:
            degree = G.degree(node)
            # Seeds are always expanded; non-seeds with high degree are visited but not expanded
            should_expand = node in start_nodes or degree < hub_threshold

            if should_expand:
                for neighbor in G.neighbors(node):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        next_frontier.append(neighbor)

        frontier = next_frontier
        if not frontier:
            break

    # Build induced edge list (edges where both endpoints are visited)
    edges = []
    for u, v in G.edges():
        if u in visited and v in visited:
            edges.append((u, v))

    return visited, edges


def subgraph_to_text(G, nodes: set[str], edges: Sequence[tuple[str, str]], token_budget: int = 2000) -> str:
    """Convert subgraph to text representation within budget.

    Returns '' when nodes is empty.
    Budget is in characters: token_budget * CHARS_PER_TOKEN.
    """
    if not nodes:
        return ''

    char_budget = token_budget * CHARS_PER_TOKEN

    # Sort nodes by (-degree, id)
    sorted_nodes = sorted(nodes, key=lambda n: (-G.degree(n), str(n)))

    # Helper to get label
    def get_label(nid: str) -> str:
        return str(G.nodes[nid].get('label', nid))

    lines = []
    running_length = 0

    # Emit nodes
    for nid in sorted_nodes:
        data = G.nodes[nid]
        label = get_label(nid)
        kind = data.get('kind', 'node')
        degree = G.degree(nid)
        source_file = data.get('source_file', '')

        line = f"- {label} [{kind}] deg={degree} src={source_file}"
        line_with_newline_cost = len(line) + 1

        if running_length + line_with_newline_cost > char_budget:
            break

        lines.append(line)
        running_length += line_with_newline_cost

    # Emit edges
    for u, v in edges:
        u_label = get_label(u)
        v_label = get_label(v)
        line = f"  {u_label} -> {v_label}"
        line_with_newline_cost = len(line) + 1

        if running_length + line_with_newline_cost > char_budget:
            break

        lines.append(line)
        running_length += line_with_newline_cost

    return '\n'.join(lines)
