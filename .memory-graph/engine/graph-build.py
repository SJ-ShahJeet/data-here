#!/usr/bin/env python3
"""CLI to build a graph from source files."""

import os
import sys
from pathlib import Path


def main() -> int:
    """Build graph and write it to memory-graph's graph directory."""
    # Determine root
    if len(sys.argv) > 1:
        root = Path(sys.argv[1])
    else:
        root_str = os.environ.get("REPO_ROOT")
        if root_str:
            root = Path(root_str)
        else:
            root = Path.cwd()

    # Put engine directory on sys.path
    engine_dir = Path(__file__).parent
    if str(engine_dir) not in sys.path:
        sys.path.insert(0, str(engine_dir))

    try:
        from mg_graph import build

        graph = build.build_graph(root)
        out_file = build.write_graph(root, graph)

        n_nodes = len(graph["nodes"])
        n_links = len(graph["links"])
        rel = out_file.relative_to(root) if out_file.is_relative_to(root) else out_file
        print(f"graph: {n_nodes} nodes, {n_links} links -> {rel}")

        return 0

    except Exception as exc:
        print(f"graph-build failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
