#!/usr/bin/env bash
# Claude Code Stop -> engine session-end.
#
# Claude's Stop fires at the end of an agent turn, which is the same moment as
# Cursor's `stop` and Copilot's `sessionEnd` — that is where a session is recorded.
#
# In : {"session_id","transcript_path"?,"stop_hook_active"?,"last_assistant_message"?}
# Out: {} | {"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"..."}}
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

_input=$(cat)

transcript=$(mg_json "$_input" transcript_path)
stop_active=$(mg_json "$_input" stop_hook_active)

# stop_hook_active means we are already inside a hook-triggered continuation.
# Map it onto the engine's loop_count guard so memory-graph cannot re-enter itself.
loop_count=0
[[ "$stop_active" == "True" || "$stop_active" == "true" ]] && loop_count=1

payload=$(python3 -c '
import json, sys
print(json.dumps({
    "status": "completed",
    "loop_count": int(sys.argv[1]),
    "transcript_path": sys.argv[2],
}))
' "$loop_count" "$transcript")

result=$(mg_engine session-end.sh "$payload")
followup=$(mg_json "$result" followup)

if [[ -z "$followup" ]]; then
  printf '{}\n'
  exit 0
fi

# Surface the semantic-compress request as context rather than `decision: block`,
# so memory-graph never keeps Claude working against the user's intent.
printf '%s' "$followup" | python3 -c '
import json, sys
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "Stop",
        "additionalContext": sys.stdin.read(),
    }
}))
'
