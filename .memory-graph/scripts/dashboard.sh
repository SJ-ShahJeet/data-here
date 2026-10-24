#!/usr/bin/env bash
# memory-graph dashboard — usage: bash scripts/dashboard.sh
set -euo pipefail

# Repo root. scripts/ lives inside .memory-graph/ after the layout
# consolidation, and at the top level in repos that predate it.
ROOT=$(cd "$(dirname "$0")/.." && pwd)
[ -d "$ROOT/.memory-graph" ] || ROOT=$(cd "$ROOT/.." && pwd)

port=8787
if ! python3 -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.bind(('127.0.0.1', 8787))
except OSError:
    raise SystemExit(1)
finally:
    s.close()
"; then
  port=$(python3 -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.bind(('127.0.0.1', 0))
print(s.getsockname()[1])
s.close()
")
fi

export REPO_ROOT="$ROOT"
export DASH_PORT="$port"

(
  sleep 1
  open "http://127.0.0.1:$port" 2>/dev/null || xdg-open "http://127.0.0.1:$port" 2>/dev/null || true
) &

DASH="$ROOT/.memory-graph/dashboard"
[ -d "$DASH" ] || DASH="$ROOT/dashboard"

if [ ! -d "$DASH/node_modules" ]; then
  echo "installing dashboard dependencies…"
  npm --prefix "$DASH" install --no-audit --no-fund
fi

echo "memory-graph dashboard: http://127.0.0.1:$port"
exec npm --prefix "$DASH" run dev -- --hostname 127.0.0.1 --port "$port"
