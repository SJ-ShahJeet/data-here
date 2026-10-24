"""Build a graph from extracted source facts."""

import json
import posixpath
import re
from collections import defaultdict
from pathlib import Path
from typing import Sequence

from . import extract


IGNORED_DIR_NAMES: frozenset[str] = frozenset({
    ".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build",
    ".next", "graphify-out", ".mypy_cache", ".pytest_cache", "vendor", "third_party"
})

MAX_FILE_BYTES: int = 1_000_000

LOUVAIN_SEED: int = 1234

GRAPH_DIR_NAME: str = "graphify-out"

# memory-graph's own directory, skipped unless graph_include_self is set.
HOME_DIR_NAME: str = ".memory-graph"

GRAPH_FILE_NAME: str = "graph.json"

# Receivers that are never a module, so `receiver.name()` cannot be naming a
# symbol defined in some other file even when the name resolves uniquely.
NON_MODULE_RECEIVERS: frozenset[str] = frozenset({"self", "cls", "this", "super"})


def _language_family(rel_path: str) -> str:
    """Which files can name each other's symbols. .ts and .tsx can; nothing else crosses."""
    lang = extract.language_for(rel_path)
    if lang in ("typescript", "tsx"):
        return "ts"
    return str(lang)


def resolve_shell_path(literal: str, rel_path: str, scanned: Sequence[str]) -> str | None:
    """Match a shell path literal against a scanned file, or None if not unique.

    The literal arrives stripped of its expansions, so `"$ROOT/engine/x.py"` is
    `/engine/x.py` and `"$(dirname ...)/../lib.sh"` is `/../lib.sh`. A relative
    literal anchors to the referring script; anything else matches on the path
    suffix. Ambiguity resolves to nothing — `session-end.sh` names four real
    files, and picking one would invent a dependency.
    """
    needle = literal.lstrip("/")
    if not needle:
        return None

    if needle.startswith("./") or needle.startswith("../"):
        candidate = posixpath.normpath(
            posixpath.join(posixpath.dirname(rel_path), needle)
        )
        return candidate if candidate in set(scanned) else None

    matches = [
        s for s in scanned
        if s.replace("\\", "/") == needle or s.replace("\\", "/").endswith("/" + needle)
    ]
    return matches[0] if len(matches) == 1 else None


def _graphs_own_home(root: Path) -> bool:
    """True when this repo wants memory-graph's own source in its graph.

    Off by default. In a consumer repo the engine, adapters, scripts and
    dashboard under .memory-graph/ are vendored tooling, not the project — left
    in, they outnumber the real code by hundreds of nodes and the god-node table
    ends up describing memory-graph instead of the repo it is installed in.
    The memory-graph toolkit itself sets `graph_include_self: true`, because
    there that code IS the project.
    """
    try:
        import mg_config
    except ImportError:
        return False
    return mg_config.config_bool(mg_config.load_config(root), "graph_include_self", False)


def scan_files(root: Path) -> list[str]:
    """Walk root and return relative POSIX paths of supported source files."""
    result = []
    skip_home = not _graphs_own_home(root)

    for path in root.rglob("*"):
        if not path.is_file():
            continue

        # Check file size
        try:
            if path.stat().st_size > MAX_FILE_BYTES:
                continue
        except (OSError, PermissionError):
            continue

        # Get relative path
        rel = path.relative_to(root)

        # Check for ignored directories in path components
        if any(part in IGNORED_DIR_NAMES for part in rel.parts):
            continue

        if skip_home and rel.parts and rel.parts[0] == HOME_DIR_NAME:
            continue

        # Check suffix
        if rel.suffix.lower() not in extract.SUPPORTED_SUFFIXES:
            continue

        # Add as POSIX path
        result.append(rel.as_posix())

    result.sort()
    return result


def _parse_jsonc(text: str) -> dict:
    """Parse a tsconfig-flavoured JSON file (comments and trailing commas allowed).

    Comments are stripped with a scanner rather than a regex because tsconfig
    values legitimately contain `/*` and `*/` inside strings — `"@/*"` and
    `"**/*.ts"` — which a regex would treat as a block comment and eat.
    """
    out = []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch == '"':
            j = i + 1
            while j < n:
                if text[j] == "\\":
                    j += 2
                    continue
                if text[j] == '"':
                    break
                j += 1
            out.append(text[i:j + 1])
            i = j + 1
        elif text.startswith("//", i):
            i = text.find("\n", i)
            if i == -1:
                break
        elif text.startswith("/*", i):
            end = text.find("*/", i + 2)
            i = n if end == -1 else end + 2
        else:
            out.append(ch)
            i += 1
    return json.loads(re.sub(r",(\s*[}\]])", r"\1", "".join(out)))


def ts_alias_map(root: Path) -> list[tuple[str, str, str]]:
    """Read every tsconfig.json into (alias_prefix, target_prefix, scope_dir) triples.

    Without this, `@/lib/scan`-style path aliases resolve to nothing and the
    import edges they represent never reach the graph.
    """
    aliases: list[tuple[str, str, str]] = []
    for cfg in sorted(root.rglob("tsconfig.json")):
        rel = cfg.relative_to(root).as_posix()
        if "node_modules" in rel.split("/"):
            continue
        try:
            data = _parse_jsonc(cfg.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            continue
        opts = data.get("compilerOptions") or {}
        paths = opts.get("paths") or {}
        if not isinstance(paths, dict):
            continue
        cfg_dir = posixpath.dirname(rel)
        base = opts.get("baseUrl") or "."
        base_dir = posixpath.normpath(posixpath.join(cfg_dir, base))
        if base_dir == ".":
            base_dir = ""
        for alias, targets in paths.items():
            if not alias.endswith("*") or not isinstance(targets, list):
                continue
            for target in targets:
                if not isinstance(target, str) or not target.endswith("*"):
                    continue
                prefix = posixpath.normpath(posixpath.join(base_dir, target[:-1]))
                aliases.append((alias[:-1], "" if prefix == "." else prefix, cfg_dir))
    return aliases


def build_graph(root: Path, rel_paths: Sequence[str] | None = None) -> dict:
    """Build a graph from files."""
    if rel_paths is None:
        rel_paths = scan_files(root)

    # Parse all files
    file_facts = {}
    for rel_path in rel_paths:
        facts = extract.parse_file(root, rel_path)
        file_facts[rel_path] = facts

    # Create nodes and collect edges data
    nodes_by_id = {}
    edges = []  # Will be deduplicated as (source, target, relation) -> source_file

    # Node 1: File nodes with 'contains' edges to their symbols
    for rel_path, facts in file_facts.items():
        fid = extract.file_id(rel_path)
        nodes_by_id[fid] = {
            "id": fid,
            "label": Path(rel_path).name,
            "kind": "file",
            "file_type": "code",
            "source_file": rel_path,
            "line": 0,
            "community": 0  # Placeholder, will be set later
        }

        # Create symbol nodes and contains edges
        for symbol in facts.symbols:
            sid = extract.symbol_id(rel_path, symbol.name)
            nodes_by_id[sid] = {
                "id": sid,
                "label": symbol.name,
                "kind": symbol.kind,
                "file_type": "code",
                "source_file": rel_path,
                "line": symbol.line,
                "community": 0  # Placeholder
            }
            # Contains edge
            edges.append((fid, sid, "contains", rel_path))

    # Edge 2: Imports
    ts_aliases = ts_alias_map(root)
    for rel_path, facts in file_facts.items():
        fid = extract.file_id(rel_path)

        for raw_import in facts.imports:
            target_fid = None

            if facts.language == "python":
                # Python import resolution
                m = raw_import.module.lstrip(".")
                mpath = m.replace(".", "/")
                candidates = [mpath + ".py", mpath + "/__init__.py"]

                # Find matching scanned files
                matches = []
                for scanned_rel in file_facts.keys():
                    scanned_posix = scanned_rel.replace("\\", "/")
                    if (scanned_posix == candidates[0] or scanned_posix == candidates[1] or
                        scanned_posix.endswith("/" + candidates[0]) or
                        scanned_posix.endswith("/" + candidates[1])):
                        matches.append(scanned_rel)

                # Only emit if exactly one match
                if len(matches) == 1:
                    target_fid = extract.file_id(matches[0])

            elif facts.language == "shell":
                match = resolve_shell_path(
                    raw_import.module, rel_path, list(file_facts.keys())
                )
                if match is not None and match != rel_path:
                    target_fid = extract.file_id(match)

            else:  # typescript or tsx
                scanned_set = set(file_facts.keys())

                def _resolve_ts(target: str) -> str | None:
                    """Try the extension and index variants for a resolved base path."""
                    for candidate in (
                        target,
                        target + ".ts",
                        target + ".tsx",
                        target + ".js",
                        target + ".jsx",
                        target + "/index.ts",
                        target + "/index.tsx",
                    ):
                        if candidate in scanned_set:
                            return extract.file_id(candidate)
                    return None

                if raw_import.module.startswith("."):
                    target_fid = _resolve_ts(posixpath.normpath(
                        posixpath.join(posixpath.dirname(rel_path), raw_import.module)
                    ))
                else:
                    # Path aliases from tsconfig (`@/lib/scan` → `dashboard/lib/scan`)
                    for alias_prefix, target_prefix, scope in ts_aliases:
                        if not raw_import.module.startswith(alias_prefix):
                            continue
                        if scope and not rel_path.startswith(scope + "/"):
                            continue
                        rest = raw_import.module[len(alias_prefix):]
                        target_fid = _resolve_ts(posixpath.normpath(
                            posixpath.join(target_prefix, rest) if target_prefix else rest
                        ))
                        if target_fid:
                            break

            if target_fid:
                edges.append((fid, target_fid, "imports", rel_path))

    # Edge 3: Calls
    # First, build name -> symbol_ids mapping
    defs_by_name: dict[str, list[str]] = defaultdict(list)
    defs_owner: dict[str, str] = {}
    for rel_path, facts in file_facts.items():
        for symbol in facts.symbols:
            sid = extract.symbol_id(rel_path, symbol.name)
            defs_by_name[symbol.name].append(sid)
            defs_owner[sid] = rel_path

    for rel_path, facts in file_facts.items():
        for call in facts.calls:
            # Resolve callee
            if call.callee not in defs_by_name or len(defs_by_name[call.callee]) != 1:
                continue

            target_sid = defs_by_name[call.callee][0]
            target_rel = defs_owner[target_sid]

            # A globally unique name is not proof the call meant this file.
            # `Path(p).resolve()` matches any lone module-level `resolve`, and
            # `nx.Graph()` matches a TypeScript `Graph` — both invent an edge
            # that inflates whatever file happened to own the name.
            if target_rel != rel_path:
                if call.receiver is not None and (
                    not call.receiver or call.receiver in NON_MODULE_RECEIVERS
                ):
                    continue
                if _language_family(target_rel) != _language_family(rel_path):
                    continue

            # Determine source
            if call.caller:
                source_sid = extract.symbol_id(rel_path, call.caller)
                source = source_sid
            else:
                source = extract.file_id(rel_path)

            # Skip self-loops
            if source == target_sid:
                continue

            edges.append((source, target_sid, "calls", rel_path))

    # Deduplicate edges, keeping first by sort order
    edges_dict = {}
    for source, target, relation, source_file in sorted(edges):
        key = (source, target, relation)
        if key not in edges_dict:
            edges_dict[key] = source_file

    # Build link list
    links = []
    for (source, target, relation), source_file in edges_dict.items():
        links.append({
            "source": source,
            "target": target,
            "relation": relation,
            "source_file": source_file
        })

    # Sort links
    links.sort(key=lambda x: (x["source"], x["target"], x["relation"]))

    # Sort nodes
    node_list = sorted(nodes_by_id.values(), key=lambda x: x["id"])

    # Assign communities
    assign_communities(node_list, links)

    # Build final graph
    graph = {
        "directed": True,
        "multigraph": False,
        "graph": {},
        "nodes": node_list,
        "links": links
    }

    return graph


def assign_communities(nodes: list[dict], links: list[dict]) -> None:
    """Assign community numbers to nodes using Louvain algorithm."""
    try:
        import networkx as nx
        from networkx.algorithms.community import louvain_communities

        # Build undirected graph
        G = nx.Graph()

        # Add all nodes
        for node in nodes:
            G.add_node(node["id"])

        # Add edges
        for link in links:
            G.add_edge(link["source"], link["target"])

        # Run Louvain
        communities_list = list(louvain_communities(G, seed=LOUVAIN_SEED))

        # Sort communities by (-size, min_node_id)
        communities_list.sort(key=lambda c: (-len(c), min(c)))

        # Create node_id -> community_number mapping
        node_community = {}
        for idx, community in enumerate(communities_list, start=1):
            for node_id in community:
                node_community[node_id] = idx

        # Assign community numbers
        for node in nodes:
            node["community"] = node_community.get(node["id"], 1)

    except ImportError:
        # If networkx is not available, assign all to community 1
        for node in nodes:
            node["community"] = 1


def graph_out_dir(root: Path) -> Path:
    """Where graph.json goes.

    Asks the layout registry rather than joining the name onto root, so the
    graph lands inside memory-graph's single home — or stays at the top level
    in a repo that predates the consolidation.
    """
    try:
        import mg_config
    except ImportError:
        return root / GRAPH_DIR_NAME
    return mg_config.graph_dir(root)


def write_graph(root: Path, graph: dict) -> Path:
    """Write graph to <memory-graph home>/graphify-out/graph.json."""
    out_dir = graph_out_dir(root)
    out_dir.mkdir(parents=True, exist_ok=True)

    out_file = out_dir / GRAPH_FILE_NAME
    out_file.write_text(json.dumps(graph, indent=2) + "\n", encoding="utf-8")

    return out_file
