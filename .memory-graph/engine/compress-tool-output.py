#!/usr/bin/env python3
"""postToolUse: rules-compress large Shell/Grep/Read outputs; archive full text on disk.

Full output still enters context on that turn; summary helps later turns and agent-brief.
Enable: config.yaml → tool_output_compress: true
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

_ENGINE = Path(__file__).resolve().parent
if str(_ENGINE) not in sys.path:
    sys.path.insert(0, str(_ENGINE))

import mg_config as mg

DEFAULT = {
    "tool_output_compress": True,
    "tool_output_min_chars": 6000,
    "tool_output_max_summary": 1200,
}


def repo_root() -> Path:
    root = os.environ.get("REPO_ROOT")
    return Path(root) if root else Path.cwd()


def load_config(root: Path) -> dict:
    cfg = dict(DEFAULT)
    path = mg.mg_home(root) / "config.yaml"
    if not path.is_file():
        return cfg
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, val = line.split(":", 1)
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key == "tool_output_compress":
            cfg[key] = val.lower() in ("true", "yes", "1")
        elif key in ("tool_output_min_chars", "tool_output_max_summary"):
            try:
                cfg[key] = int(val)
            except ValueError:
                pass
    return cfg


# Host tool name → neutral kind. Cursor calls its shell tool "Shell", Claude
# Code and Copilot call theirs "Bash"; without this the compressor silently
# ignored every shell command outside Cursor.
TOOL_ALIASES = {
    "shell": "Shell",
    "bash": "Shell",
    "run_in_terminal": "Shell",
    "terminal": "Shell",
    "grep": "Grep",
    "search": "Grep",
    "ripgrep": "Grep",
    "read": "Read",
    "read_file": "Read",
    "view": "Read",
    "glob": "Glob",
    "list_dir": "Glob",
    "findfiles": "Glob",
}


def normalise_tool(tool_name: str) -> str:
    return TOOL_ALIASES.get(tool_name.strip().lower(), tool_name.strip())


def extract_text(tool_name: str, tool_output: str) -> str:
    try:
        payload = json.loads(tool_output)
    except json.JSONDecodeError:
        return tool_output

    if isinstance(payload, str):
        return payload

    if tool_name == "Shell":
        parts = []
        if "exitCode" in payload:
            parts.append(f"exit={payload['exitCode']}")
        for key in ("stdout", "stderr", "output"):
            if payload.get(key):
                parts.append(str(payload[key]))
        return "\n".join(parts) if parts else json.dumps(payload)[:8000]

    if tool_name in ("Read", "Grep", "Glob"):
        for key in ("content", "output", "stdout", "text", "results"):
            if payload.get(key):
                val = payload[key]
                if isinstance(val, list):
                    return "\n".join(str(x) for x in val)
                return str(val)

    return json.dumps(payload, ensure_ascii=False)


def compress_shell(text: str, max_summary: int) -> str:
    lines = text.splitlines()
    header = lines[0] if lines and lines[0].startswith("exit=") else ""
    body = lines[1:] if header else lines
    n = len(body)
    if n <= 40:
        out = "\n".join([header] + body if header else body)
        return out[:max_summary]
    head = body[:15]
    tail = body[-10:]
    mid = f"... [{n - 25} lines omitted] ..."
    parts = []
    if header:
        parts.append(header)
    parts.extend(head)
    parts.append(mid)
    parts.extend(tail)
    return "\n".join(parts)[:max_summary]


def compress_grep(text: str, max_summary: int) -> str:
    lines = [ln for ln in text.splitlines() if ln.strip()]
    n = len(lines)
    if n <= 20:
        return "\n".join(lines)[:max_summary]
    sample = lines[:15]
    return ("\n".join(sample) + f"\n... ({n - 15} more matches) ...")[:max_summary]


def compress_generic(text: str, max_summary: int) -> str:
    lines = text.splitlines()
    if len(lines) <= 35:
        return text[:max_summary]
    head = lines[:20]
    tail = lines[-8:]
    return ("\n".join(head) + f"\n... [{len(lines) - 28} lines omitted] ...\n" + "\n".join(tail))[:max_summary]


def compress_text(tool_name: str, text: str, max_summary: int) -> str:
    if tool_name == "Shell":
        return compress_shell(text, max_summary)
    if tool_name == "Grep":
        return compress_grep(text, max_summary)
    return compress_generic(text, max_summary)


def write_archive(root: Path, tool_use_id: str, tool_name: str, full: str) -> Path:
    d = mg.memory_dir(root) / ".tool-brief"
    d.mkdir(parents=True, exist_ok=True)
    safe_id = re.sub(r"[^\w.-]", "_", tool_use_id or "unknown")[:64]
    path = d / f"{safe_id}.txt"
    path.write_text(f"tool: {tool_name}\n\n{full}", encoding="utf-8")
    # Keep last summary pointer. Path.write_text has no `append` parameter —
    # passing one raised TypeError and killed every compression attempt.
    summary_path = mg.memory_dir(root) / ".tool-brief-last.txt"
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    summary_path.write_text(
        f"tool: {tool_name}\narchived: memory/.tool-brief/{safe_id}.txt\nat: {ts}\n",
        encoding="utf-8",
    )
    return path


def _append_ledger(root: Path, tool: str, before: int, after: int) -> None:
    """Append one compression record for the dashboard. Never fatal."""
    try:
        path = mg.memory_dir(root) / ".compression-log.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        record = {
            "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "tool": tool,
            "before": before,
            "after": after,
        }
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record) + "\n")
    except OSError:
        pass


def main() -> int:
    root = repo_root()
    cfg = load_config(root)
    if not cfg.get("tool_output_compress"):
        print("{}")
        return 0

    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        print("{}")
        return 0

    # Adapters normalise their host's tool names into these neutral kinds, so
    # the engine never has to know that Cursor says "Shell" and Claude says "Bash".
    tool_name = normalise_tool(payload.get("tool_name") or "")
    if tool_name not in ("Shell", "Grep", "Read", "Glob"):
        print("{}")
        return 0

    tool_output = payload.get("tool_output") or ""
    if not tool_output:
        print("{}")
        return 0

    text = extract_text(tool_name, tool_output)
    min_chars = int(cfg.get("tool_output_min_chars") or 6000)
    if len(text) < min_chars:
        print("{}")
        return 0

    max_summary = int(cfg.get("tool_output_max_summary") or 1200)
    summary = compress_text(tool_name, text, max_summary)
    tool_use_id = payload.get("tool_use_id") or "last"
    archive = write_archive(root, tool_use_id, tool_name, text)

    _append_ledger(root, tool_name, len(text), len(summary))

    rel = archive.relative_to(root)
    last = mg.memory_dir(root) / ".tool-brief-last.txt"
    last.write_text(
        last.read_text(encoding="utf-8") + f"\nsummary:\n{summary}\n",
        encoding="utf-8",
    )

    # Refresh merged brief if enabled
    brief_py = root / ".memory-graph" / "engine" / "assemble-agent-brief.py"
    if brief_py.is_file():
        import subprocess

        subprocess.run(
            [sys.executable, str(brief_py)],
            env={**os.environ, "REPO_ROOT": str(root)},
            capture_output=True,
            timeout=30,
            check=False,
        )

    ctx = (
        f"[memory-graph] Large {tool_name} output ({len(text)} chars) archived at {rel}. "
        f"Summary: {summary[:800]}"
    )
    # Two fields, because hosts differ in what they can do with them:
    #   replacement — the trimmed output itself. Claude Code and Copilot can
    #     substitute this for the real result, which is where tokens are saved.
    #   context — a note for hosts that can only append (Cursor).
    # Adapters pick whichever their host supports.
    replacement = (
        f"{summary}\n\n"
        f"[memory-graph] Truncated from {len(text)} chars. "
        f"Full output: {rel}"
    )
    print(json.dumps({"context": ctx, "replacement": replacement}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
