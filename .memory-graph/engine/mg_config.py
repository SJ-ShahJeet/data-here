#!/usr/bin/env python3
"""Unified memory-graph config loader.

Supports:
  - Nested config.yaml (profile + core + ollama sections)
  - Legacy flat config.yaml keys at top level
  - Legacy .memory-graph/ollama.yaml overlay
"""

from __future__ import annotations

import re
from pathlib import Path

PROFILE_PRESETS: dict[str, dict] = {
    "minimal": {
        "agent_brief": False,
        "tool_output_compress": False,
        "ollama_context_on_start": False,
        "graph_scout_local": False,
        "graph_scout_on_stop": False,
        "session_fill_from_transcript": True,
    },
    "standard": {
        "agent_brief": True,
        "tool_output_compress": True,
        "ollama_context_on_start": False,
        "graph_scout_local": False,
        "graph_scout_on_stop": True,
        "session_fill_from_transcript": True,
    },
    "token-first": {
        "agent_brief": True,
        "tool_output_compress": True,
        "ollama_context_on_start": True,
        "graph_scout_local": False,
        "graph_scout_on_stop": False,
        "session_fill_from_transcript": True,
    },
}

DEFAULTS: dict = {
    "profile": "standard",
    "track": "auto",
    "git_noise_threshold": 25,
    "scope_max": 40,
    "session_fill_from_transcript": True,
    "session_context_max_chars": 600,
    "archive_why_fields": True,
    "archive_enrich_on_move": True,
    "archive_monthly_summary": True,
    "graph_summary_on_stop": True,
    "session_min_files": 3,
    "graph_scout_local": False,
    "graph_scout_budget": 500,
    "graph_scout_summarize": False,
    "graph_scout_on_stop": True,
    "agent_brief": True,
    "agent_brief_max_lines": 45,
    "inject_budget_tokens": 6000,
    "inject_kinds": "Decision,Constraint,Open thread,Dependency,Test/CI fact",
    "inject_min_weight": 0.3,
    "decay_half_life_days": 30,
    "tool_output_compress": True,
    "tool_output_min_chars": 6000,
    "tool_output_max_summary": 1200,
    "ollama_context_on_start": False,
    "ollama_context_max_lines": 15,
    "ollama_context_cache_mins": 30,
    "ollama_context_max_chars": 1200,
    # ollama section (also exposed flat as ollama_* where useful)
    "enabled": False,
    "host": "http://127.0.0.1:11434",
    "model": "llama3.2:3b",
    "max_archive_chars": 12000,
    "max_archive_files": 2,
    "timeout": 120,
    "temperature": 0.0,
}

_SECTION_KEYS = frozenset({"core", "ollama"})

# ── Host registry ────────────────────────────────────────────────────────────
# The single place that knows anything about specific agents. Engine code asks
# this module which hosts are installed and where their briefs live; it never
# hardcodes a host path itself. Adding a host = one entry here + one adapter.
HOSTS: dict[str, dict] = {
    "cursor": {
        "brief": ".cursor/rules/main.mdc",
        "marker": ".cursor/hooks.json",
        "internal": (".cursor/",),
    },
    "claude": {
        "brief": "CLAUDE.md",
        "marker": ".claude/settings.json",
        "internal": (".claude/",),
    },
    "copilot": {
        "brief": ".github/copilot-instructions.md",
        "marker": ".github/hooks/memory-graph.json",
        "internal": (".github/",),
    },
}

# ── Layout ───────────────────────────────────────────────────────────────────
# memory-graph installs into exactly one directory. Engine, adapters, config,
# working memory, session history, graph output, scripts and the dashboard all
# live under HOME_DIR, so adopting the tool costs a repo one entry rather than
# eight. The only files that stay outside it are the ones a host reads from a
# fixed location — each host's brief and hook registration, see HOSTS above.
HOME_DIR: str = ".memory-graph"

# Logical name → path relative to HOME_DIR. Call sites ask for the name, so
# moving something later is one line here instead of a sweep through the engine.
OWNED_PATHS: dict[str, str] = {
    "memory": "memory",
    "sessions": "sessions",
    "graph": "graphify-out",
    "index": "memory.md",
    "scripts": "scripts",
    "dashboard": "dashboard",
}


def mg_home(root: Path) -> Path:
    """The one directory memory-graph installs into."""
    return Path(root) / HOME_DIR


# The paths whose presence tells us which layout a repo is on. `scripts` and
# `dashboard` are deliberately excluded — plenty of projects have their own
# scripts/ at the root, and mistaking it for ours would drag the whole repo
# back to the legacy layout.
LAYOUT_MARKERS: tuple[str, ...] = ("memory", "sessions", "graphify-out", "memory.md")


def is_legacy_layout(root: Path) -> bool:
    """True when this repo still keeps memory-graph's data at the top level.

    One decision for the whole repo, deliberately — resolving each path on its
    own lets a repo end up half-migrated in memory, with sessions/ at the root
    while state.yaml goes into the new home, which breaks every link in the
    index. The consolidated home wins as soon as it holds any of these, so a
    part-way migration lands on the new layout rather than straddling both.
    """
    root = Path(root)
    home = root / HOME_DIR
    if any((home / rel).exists() for rel in LAYOUT_MARKERS):
        return False
    return any((root / rel).exists() for rel in LAYOUT_MARKERS)


def mg_path(root: Path, name: str) -> Path:
    """Absolute path for one of memory-graph's own files or directories.

    Resolves into the consolidated home, or the pre-consolidation top-level
    location in a repo that still uses it — upgrading the engine on its own
    must never orphan an existing repo's memory. Run
    `scripts/upgrade-memory-graph.sh --migrate-layout` to move for real.
    """
    root = Path(root)
    base = root if is_legacy_layout(root) else root / HOME_DIR
    return base / OWNED_PATHS[name]


def memory_dir(root: Path) -> Path:
    return mg_path(root, "memory")


def sessions_dir(root: Path) -> Path:
    return mg_path(root, "sessions")


def graph_dir(root: Path) -> Path:
    return mg_path(root, "graph")


def graph_json(root: Path) -> Path:
    return graph_dir(root) / "graph.json"


def memory_index(root: Path) -> Path:
    """The session index. Beside sessions/ by construction, so its relative
    links to session files always resolve."""
    return mg_path(root, "index")


# Paths memory-graph writes itself. Edits to these must never create a session,
# or the tool records its own bookkeeping as project work and loops. The
# consolidated layout is covered by the `.memory-graph/` prefix alone; the bare
# names stay listed so repos still on the legacy layout are filtered too.
INTERNAL_PREFIXES: tuple[str, ...] = tuple(
    sorted({p for h in HOSTS.values() for p in h["internal"]})
) + (HOME_DIR + "/", "sessions/", "graphify-out/", "memory/")

INTERNAL_FILES: frozenset[str] = frozenset({"memory.md", "CLAUDE.md", "AGENTS.md"})


def installed_hosts(root: Path) -> list[str]:
    """Hosts with an adapter installed in this repo."""
    return [
        name
        for name, spec in HOSTS.items()
        if (root / spec["marker"]).is_file()
    ]


def host_briefs(root: Path) -> list[Path]:
    """Brief files to keep in sync, one per installed host.

    Falls back to any brief that already exists, so a repo that was set up by
    hand (rules file but no adapter yet) still gets its god-node table updated.
    """
    hosts = installed_hosts(root)
    if hosts:
        return [root / HOSTS[h]["brief"] for h in hosts]
    return [
        root / spec["brief"]
        for spec in HOSTS.values()
        if (root / spec["brief"]).is_file()
    ]


def is_internal_path(rel_path: str) -> bool:
    """True when a repo-relative path is memory-graph's own bookkeeping."""
    # Strip leading "./" and "/" only. `lstrip("./")` looks equivalent but
    # strips any leading '.' or '/' character, which ate the dot off every
    # dotted internal path — ".memory-graph/…" became "memory-graph/…" and
    # matched nothing. With the whole tool now living under .memory-graph/,
    # that would classify its own writes as project work.
    rel = rel_path.strip()
    while rel.startswith("./") or rel.startswith("/"):
        rel = rel[2:] if rel.startswith("./") else rel[1:]
    if not rel:
        return True
    if rel in INTERNAL_FILES:
        return True
    return rel.startswith(INTERNAL_PREFIXES)


def _coerce_value(raw: str):
    val = raw.strip().strip('"').strip("'")
    low = val.lower()
    if low in ("true", "false", "yes", "no"):
        return low in ("true", "yes")
    if re.fullmatch(r"-?\d+", val):
        return int(val)
    if re.fullmatch(r"-?\d+\.\d+", val):
        return float(val)
    return val


def _parse_yaml_sections(text: str) -> tuple[str | None, dict, dict, dict]:
    """Return (profile, flat, core, ollama) from config file text."""
    profile: str | None = None
    flat: dict = {}
    core: dict = {}
    ollama: dict = {}
    section: str | None = None

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if ":" not in stripped:
            continue

        if not line.startswith((" ", "\t")):
            key, _, val = stripped.partition(":")
            key = key.strip()
            val = val.strip()
            if key in _SECTION_KEYS and not val:
                section = key
                continue
            section = None
            if key == "profile":
                profile = str(_coerce_value(val))
            else:
                flat[key] = _coerce_value(val)
            continue

        if section == "core":
            key, _, val = stripped.partition(":")
            core[key.strip()] = _coerce_value(val.strip())
        elif section == "ollama":
            key, _, val = stripped.partition(":")
            ollama[key.strip()] = _coerce_value(val.strip())

    return profile, flat, core, ollama


def _read_legacy_ollama(root: Path) -> dict:
    path = mg_home(root) / "ollama.yaml"
    if not path.is_file():
        return {}
    out: dict = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, val = line.split(":", 1)
        out[key.strip()] = _coerce_value(val)
    return out


def load_config(root: Path) -> dict:
    """Flat merged config for hooks and scripts."""
    cfg = dict(DEFAULTS)

    path = mg_home(root) / "config.yaml"
    profile_name: str | None = None
    flat: dict = {}
    core: dict = {}
    ollama_sec: dict = {}

    if path.is_file():
        profile_name, flat, core, ollama_sec = _parse_yaml_sections(
            path.read_text(encoding="utf-8", errors="replace")
        )

    if profile_name and profile_name in PROFILE_PRESETS:
        cfg.update(PROFILE_PRESETS[profile_name])
    cfg["profile"] = profile_name or cfg.get("profile", "standard")

    cfg.update(core)
    cfg.update(flat)
    cfg.update(ollama_sec)

    legacy_ollama = _read_legacy_ollama(root)
    if legacy_ollama:
        cfg.update(legacy_ollama)

    if "enabled" in cfg:
        cfg["ollama_enabled"] = bool(cfg["enabled"])

    return cfg


def load_ollama_config(root: Path) -> dict | None:
    """Ollama connection config if enabled; None otherwise."""
    cfg = load_config(root)
    if not cfg.get("enabled"):
        return None
    return {
        "enabled": True,
        "host": str(cfg.get("host", DEFAULTS["host"])),
        "model": str(cfg.get("model", DEFAULTS["model"])),
        "max_archive_chars": int(cfg.get("max_archive_chars", DEFAULTS["max_archive_chars"])),
        "max_archive_files": int(cfg.get("max_archive_files", DEFAULTS["max_archive_files"])),
        "timeout": int(cfg.get("timeout", DEFAULTS["timeout"])),
        "temperature": float(cfg.get("temperature", DEFAULTS["temperature"])),
        "graph_scout_summarize": bool(cfg.get("graph_scout_summarize", False)),
        "archive_monthly_summary": bool(cfg.get("archive_monthly_summary", True)),
    }


def config_bool(cfg: dict, key: str, default: bool = False) -> bool:
    val = cfg.get(key, default)
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("true", "yes", "1")
    return bool(val)
