#!/usr/bin/env python3
"""CLI to detect blast radius from changed files."""

from __future__ import annotations

import json
import os
import shlex
import sys
from pathlib import Path

_ENGINE = Path(__file__).resolve().parent
if str(_ENGINE) not in sys.path:
    sys.path.insert(0, str(_ENGINE))

from mg_graph import blast, rank

import mg_config as mg


def main() -> int:
    """Main entry point for graph-blast CLI.

    Environment:
    - REPO_ROOT: repository root (defaults to cwd)
    - CHANGED_FILES: newline-separated changed file paths

    Output:
    - Prints shell-quoted variable assignments suitable for eval
    - Always returns 0; exceptions are swallowed to protect session-end pipeline
    """
    try:
        root = Path(os.environ.get('REPO_ROOT') or Path.cwd())
        changed_str = os.environ.get('CHANGED_FILES', '')
        changed_files = [f.strip() for f in changed_str.splitlines() if f.strip()]

        # Load graph
        graph_path = mg.graph_json(root)
        if not graph_path.is_file():
            return 0

        graph = rank.load_graph_json(graph_path)
        if not graph.get('nodes'):
            return 0

        # Run blast radius detection
        result = blast.blast_radius(graph, changed_files)

        # Emit output (only if values are non-empty)
        if result.get('god_nodes_hit'):
            god_nodes_str = ', '.join(result['god_nodes_hit'])
            print(f"GOD_NODES_HIT={shlex.quote(god_nodes_str)}")

        if result.get('facts'):
            facts_str = '\n'.join(f"- {f}" for f in result['facts'])
            print(f"GRAPH_FACTS={shlex.quote(facts_str)}")

        return 0

    except Exception:
        # Swallow all exceptions to never break session-end pipeline
        return 0


if __name__ == '__main__':
    sys.exit(main())
