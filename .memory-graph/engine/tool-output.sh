#!/usr/bin/env bash
# postToolUse — compress large tool outputs (rules-based, no LLM).
set -euo pipefail

ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
PY="$ROOT/.memory-graph/engine/compress-tool-output.py"
[[ -f "$PY" ]] || { printf '{}\n'; exit 0; }

REPO_ROOT="$ROOT" python3 "$PY"
