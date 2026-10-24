#!/usr/bin/env bash
# Local graph scout — in-repo graph query + compact YAML (no Cursor subagent).
set -euo pipefail

# Repo root. scripts/ lives inside .memory-graph/ after the layout
# consolidation, and at the top level in repos that predate it.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
[ -d "$ROOT/.memory-graph" ] || ROOT=$(cd "$ROOT/.." && pwd)
PY="$ROOT/.memory-graph/engine/graph-scout-local.py"

if [[ ! -f "$PY" ]]; then
  echo "Missing $PY" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/graph-scout-local.sh \"<files or concepts in scope>\"" >&2
  echo "Enable first: bash scripts/enable-graph-scout-local.sh" >&2
  exit 1
fi

REPO_ROOT="$ROOT" python3 "$PY" "$*"
