#!/usr/bin/env python3
"""Write the ## Codebase section in each agent brief from the ranked god nodes.

Ledger-triggered (no git). Ollama when enabled; deterministic fallback otherwise.
Preserves ## Working On (human-edited) and ## Where to go sections.
"""

from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path


def _load_mg_config():
    path = Path(__file__).resolve().parent / "mg_config.py"
    spec = importlib.util.spec_from_file_location("mg_config", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


mg = _load_mg_config()

_ENGINE = Path(__file__).resolve().parent
if str(_ENGINE) not in sys.path:
    sys.path.insert(0, str(_ENGINE))
from mg_graph import rank


def repo_root() -> Path:
    root = os.environ.get("REPO_ROOT")
    return Path(root) if root else Path.cwd()


def top_god_nodes(graph_path: Path, limit: int = 8) -> list[tuple[str, int]]:
    data = rank.load_graph_json(graph_path)
    return [(str(g["label"]), int(g["edges"])) for g in rank.god_nodes(data, limit=limit)]


def deterministic_summary(root: Path) -> str:
    gods = top_god_nodes(mg.graph_json(root), 6)
    lines: list[str] = []
    if gods:
        god_bits = ", ".join(f"`{name}` ({deg})" for name, deg in gods[:5])
        lines.append(f"Core abstractions (god nodes): {god_bits}.")
    if not lines:
        return "_No graph yet. Run `python3 .memory-graph/engine/graph-build.py .` once to build._"
    return " ".join(lines)[:900]


def ollama_summary(root: Path, cfg: dict) -> str | None:
    gods = top_god_nodes(mg.graph_json(root), 8)
    if not gods:
        return None
    god_lines = "\n".join(f"- {name} ({deg} edges)" for name, deg in gods)
    system = """You summarize a codebase for a coding agent's always-on project brief.

Reply with plain prose only — no YAML, no markdown headings, no bullet lists.
Max 12 lines. Describe: what the repo does, major subsystems/communities, and
which god nodes are central. Be concrete; do not invent modules not in the source."""
    user = f"GOD NODES:\n{god_lines}"
    url = str(cfg["host"]).rstrip("/") + "/api/chat"
    body = json.dumps(
        {
            "model": cfg["model"],
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user[:8000]},
            ],
            "stream": False,
            "options": {"temperature": float(cfg.get("temperature", 0))},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=int(cfg.get("timeout", 60))) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    text = ((data.get("message") or {}).get("content") or "").strip()
    return text[:1200] if text else None


def _default_main_mdc(repo_name: str, host: str = "cursor") -> str:
    # Only Cursor's .mdc format carries frontmatter; CLAUDE.md and
    # copilot-instructions.md are plain markdown and would render it as text.
    frontmatter = ""
    if host == "cursor":
        frontmatter = (
            "---\n"
            f"description: Project compass — working focus + codebase summary for {repo_name}.\n"
            "alwaysApply: true\n"
            "---\n\n"
        )
    return f"""{frontmatter}# {repo_name}

## Working On

<!-- Edit this section: what you are building this week (1–3 sentences). Hooks never overwrite. -->
_Not set._

## Codebase

<!-- graph-summary-updated: never -->
_No graph yet. Run `python3 .memory-graph/engine/graph-build.py .` once to build._

## Where to go

- **Living state (every session):** `memory/.agent-brief.yaml`
- **Tier map (read once):** `memory/README.md`
"""


def _extract_section(mdc: str, heading: str) -> str:
    pat = rf"(## {re.escape(heading)}\n\n)(.*?)(?=\n## |\Z)"
    m = re.search(pat, mdc, re.DOTALL)
    return m.group(2).strip() if m else ""


def _replace_section(mdc: str, heading: str, body: str, marker_comment: str | None = None) -> str:
    body = body.strip()
    if marker_comment:
        body = f"<!-- {marker_comment}: {date.today().isoformat()} -->\n{body}"
    pat = rf"(## {re.escape(heading)}\n\n)(.*?)(?=\n## |\Z)"
    if re.search(pat, mdc, re.DOTALL):
        return re.sub(pat, rf"\g<1>{body}\n\n", mdc, count=1, flags=re.DOTALL)
    return mdc.rstrip() + f"\n\n## {heading}\n\n{body}\n"


def _is_legacy_mdc(mdc: str) -> bool:
    return "## God Nodes" in mdc or "## Session Memory" in mdc or "## Purpose" in mdc


def _migrate_legacy_mdc(mdc: str, repo_name: str, host: str = "cursor") -> str:
    working = _extract_section(mdc, "Purpose")
    if not working or working.startswith("_Not set"):
        working = _extract_section(mdc, "Working On")
    if not working or working.startswith("_Not set"):
        working = "_Not set._"
    return _default_main_mdc(repo_name, host).replace("_Not set._", working, 1)


def _apply_summary(brief_path: Path, repo_name: str, host: str, summary: str) -> None:
    """Write the Codebase section into one host's brief, preserving Working On."""
    if brief_path.is_file():
        text = brief_path.read_text(encoding="utf-8", errors="replace")
        if _is_legacy_mdc(text) and "## Codebase" not in text:
            text = _migrate_legacy_mdc(text, repo_name, host)
    else:
        brief_path.parent.mkdir(parents=True, exist_ok=True)
        text = _default_main_mdc(repo_name, host)

    working_on = _extract_section(text, "Working On") or "_Not set._"

    text = _replace_section(text, "Working On", working_on)
    text = _replace_section(
        text, "Codebase", summary, marker_comment="graph-summary-updated"
    )
    if "## Where to go" not in text:
        text = text.rstrip() + (
            "\n\n## Where to go\n\n"
            "- **Living state (every session):** `memory/.agent-brief.yaml`\n"
            "- **Tier map (read once):** `memory/README.md`\n"
        )

    brief_path.write_text(text.strip() + "\n", encoding="utf-8")


def update_main_mdc(root: Path) -> tuple[bool, str]:
    """Sync the generated Codebase summary into every installed host's brief.

    The summary is computed once (it may call Ollama) and then written to each
    host, so a repo used from Cursor and Claude Code shows the same god nodes.
    """
    cfg = mg.load_config(root)
    if not mg.config_bool(cfg, "graph_summary_on_stop", True):
        return False, "graph_summary_on_stop disabled"

    repo_name = root.name

    ollama_cfg = mg.load_ollama_config(root)
    summary = None
    if ollama_cfg:
        summary = ollama_summary(root, ollama_cfg)
    if not summary:
        summary = deterministic_summary(root)

    briefs = mg.host_briefs(root)
    if not briefs:
        # Nothing installed yet — default to the Cursor rules file so a bare
        # `/graphify .` before setup still produces something useful.
        briefs = [root / mg.HOSTS["cursor"]["brief"]]

    brief_by_path = {
        root / spec["brief"]: name for name, spec in mg.HOSTS.items()
    }
    written = []
    for brief_path in briefs:
        host = brief_by_path.get(brief_path, "cursor")
        _apply_summary(brief_path, repo_name, host, summary)
        written.append(host)

    return True, f"updated Codebase ({len(summary)} chars) in: {', '.join(written)}"


def main() -> int:
    root = repo_root()
    ok, msg = update_main_mdc(root)
    if not ok:
        print(msg, file=sys.stderr)
        return 1
    print(msg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
