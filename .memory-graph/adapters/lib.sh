#!/usr/bin/env bash
# memory-graph adapter helpers.
#
# Adapters are translators. Each one converts its host's hook payload into the
# engine's neutral contract, runs the engine, and converts the neutral result
# back into what the host expects. They contain no memory-graph logic — if you
# find yourself adding behaviour here, it belongs in the engine instead.
#
# Neutral contract (see .memory-graph/engine/):
#   session-start.sh  stdin {}                                  -> {"context": str}
#   session-end.sh    stdin {status, loop_count, transcript_path} -> {} | {"followup": str}
#   tool-output.sh    stdin {tool_name, tool_output, tool_use_id} -> {} | {"context", "replacement"}
#   track-file.sh     stdin {file_path, root}                    -> (no output)

set -uo pipefail

MG_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
MG_ENGINE="$MG_ROOT/.memory-graph/engine"
export REPO_ROOT="$MG_ROOT"

# mg_json <payload> <expr...> — read fields from a JSON payload.
# Uses python3 (already a hard requirement) rather than jq, which is not
# installed by default on macOS and silently degraded the old adapters.
mg_json() {
  local payload="$1"; shift
  printf '%s' "$payload" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    d = {}
if not isinstance(d, dict):
    d = {}
for key in sys.argv[1:]:
    val = d
    for part in key.split("."):
        if isinstance(val, list):
            try:
                val = val[int(part)]
            except (ValueError, IndexError):
                val = ""
                break
        elif isinstance(val, dict):
            val = val.get(part, "")
        else:
            val = ""
            break
    if val is None or isinstance(val, (dict, list)):
        val = ""
    print(val)
' "$@" 2>/dev/null || true
}

# mg_emit <key=value ...> — print a JSON object built from literal string pairs.
mg_emit() {
  python3 -c '
import json, sys
out = {}
for arg in sys.argv[1:]:
    key, _, val = arg.partition("=")
    out[key] = val
print(json.dumps(out))
' "$@"
}

# mg_engine <script> [stdin-json] — run an engine entrypoint, return its stdout.
mg_engine() {
  local script="$MG_ENGINE/$1"; shift
  local payload="${1:-{\}}"
  [[ -f "$script" ]] || { printf '{}'; return 0; }
  printf '%s' "$payload" | REPO_ROOT="$MG_ROOT" bash "$script" 2>/dev/null || printf '{}'
}
