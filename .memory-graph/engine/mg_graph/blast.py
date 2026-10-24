"""Blast radius detection — finding god nodes hit by changed files."""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from mg_graph import rank

MAX_COMMUNITY_FACTS: int = 4
MAX_GOD_NODES_IN_FACT: int = 5
HIT_RISKS: frozenset[str] = frozenset({"CRITICAL", "HIGH"})


def normalise_path(path: str) -> str:
    """Normalize path: backslashes to forward slashes, strip leading './'.

    normalise_path('./src/a.py') == 'src/a.py'
    normalise_path('  src\\a.py ') == 'src/a.py'
    normalise_path('') == ''
    """
    normalized = str(path).replace('\\', '/').strip()
    while normalized.startswith('./'):
        normalized = normalized[2:]
    return normalized


def blast_radius(graph: Mapping[str, Any], changed_files: Sequence[str]) -> dict[str, list[str]]:
    """Detect god nodes hit by changed files.

    Returns {'god_nodes_hit': list[str], 'facts': list[str]}.
    """
    # Step 1: Normalize and dedup changed files, dropping empties
    changed = []
    seen = set()
    for f in changed_files:
        normalized = normalise_path(f)
        if normalized and normalized not in seen:
            changed.append(normalized)
            seen.add(normalized)

    if not changed:
        return {'god_nodes_hit': [], 'facts': []}

    # Step 2: Get risks by file
    risks = rank.risk_by_file(graph)

    # Step 3 & 4: Find changed files and collect god nodes and communities
    nodes = graph.get('nodes', [])
    god_nodes_hit = []
    touched_communities: dict[str, list[str]] = {}

    for changed_path in changed:
        # Find all nodes belonging to this changed file
        found_for_path = False

        for node in nodes:
            node_source_file = node.get('source_file') or node.get('label') or node.get('id', '')
            node_source_file_norm = normalise_path(node_source_file)

            # Exact equality check (bug fix 2)
            if node_source_file_norm != changed_path:
                continue

            found_for_path = True

            # Collect community info
            community_str = str(node.get('community', '?'))
            if community_str not in touched_communities:
                touched_communities[community_str] = []

            node_label = str(node.get('label', node.get('id', '')))
            if node_label not in touched_communities[community_str]:
                touched_communities[community_str].append(node_label)

            # Check if this is a high-risk file node
            if node.get('kind') == 'file':
                risk = risks.get(changed_path, 'LOW')
                if risk in HIT_RISKS:
                    file_label = node_label
                    god_nodes_hit.append(f'{file_label} ({risk})')
                    break  # Only add once per file

        # If no file node was found, try by basename
        if not found_for_path:
            risk = risks.get(changed_path, 'LOW')
            if risk in HIT_RISKS:
                basename = changed_path.split('/')[-1] if '/' in changed_path else changed_path
                god_nodes_hit.append(f'{basename} ({risk})')

    # Step 5 & 6: Build facts
    facts = []

    # Add god nodes fact if any hits
    if god_nodes_hit:
        god_nodes_sample = god_nodes_hit[:MAX_GOD_NODES_IN_FACT]
        facts.append(f"god nodes in blast radius: {', '.join(god_nodes_sample)}")

    # Add community facts
    for i, comm_key in enumerate(sorted(touched_communities.keys())):
        if i >= MAX_COMMUNITY_FACTS:
            break
        labels = touched_communities[comm_key]
        sample_labels = labels[:3]
        sample = ', '.join(sample_labels)
        if len(labels) > 3:
            sample += f" (+{len(labels) - 3} more)"
        facts.append(f'community {comm_key}: {sample}')

    return {'god_nodes_hit': god_nodes_hit, 'facts': facts}
