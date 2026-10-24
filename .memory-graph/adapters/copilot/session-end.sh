#!/usr/bin/env bash
# GitHub Copilot sessionEnd -> engine session-end.
# In : {"sessionId","reason","cwd","transcriptPath"?}
# Out: {} | {"additionalContext": "..."}
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

_input=$(cat)

reason=$(mg_json "$_input" reason)
transcript=$(mg_json "$_input" transcriptPath)

# Don't record a session for an aborted or errored turn.
if [[ "$reason" == "error" || "$reason" == "abort" ]]; then
  printf '{}\n'
  exit 0
fi

# Copilot has no per-edit event of its own; file tracking rides on postToolUse
# (see track-file.sh), which writes the same ledger every other host uses.
payload=$(python3 -c '
import json, sys
print(json.dumps({
    "status": "completed",
    "loop_count": 0,
    "transcript_path": sys.argv[1],
}))
' "$transcript")

result=$(mg_engine session-end.sh "$payload")
followup=$(mg_json "$result" followup)

if [[ -z "$followup" ]]; then
  printf '{}\n'
  exit 0
fi

mg_emit "additionalContext=$followup"
