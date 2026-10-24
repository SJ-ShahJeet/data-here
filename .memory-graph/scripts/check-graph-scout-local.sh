#!/usr/bin/env bash
# Check local graph scout setup.
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

REPO_ROOT="$ROOT" python3 "$PY" --check
exit $?
