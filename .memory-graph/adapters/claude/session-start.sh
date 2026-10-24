#!/usr/bin/env bash
# Claude Code SessionStart -> engine session-start.
#
# In : {"session_id","cwd","source","permission_mode",...}
# Out: {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

_input=$(cat)
result=$(mg_engine session-start.sh '{}')
context=$(mg_json "$result" context)

if [[ -z "$context" ]]; then
  printf '{}\n'
  exit 0
fi

printf '%s' "$context" | python3 -c '
import json, sys
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": sys.stdin.read(),
    }
}))
'
