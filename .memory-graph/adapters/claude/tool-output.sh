#!/usr/bin/env bash
# Claude Code PostToolUse -> engine tool-output.
#
# In : {"tool_name","tool_result","tool_use_id","tool_result_type",...}
# Out: {"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":"..."}}
#
# Claude supports `updatedToolOutput`, which REPLACES the result the model sees.
# That is where the token saving actually happens — an appended note would leave
# the original oversized output in context.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

_input=$(cat)

tool_name=$(mg_json "$_input" tool_name)
tool_use_id=$(mg_json "$_input" tool_use_id)
result_type=$(mg_json "$_input" tool_result_type)

# Never rewrite an error result — the model needs the real failure text.
if [[ "$result_type" == "error" ]]; then
  printf '{}\n'
  exit 0
fi

# tool_result may be a string or a structured object; hand the engine the raw
# JSON value and let its extract_text() sort it out.
payload=$(printf '%s' "$_input" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    d = {}
res = d.get("tool_result")
if not isinstance(res, str):
    res = json.dumps(res) if res is not None else ""
print(json.dumps({
    "tool_name": d.get("tool_name") or "",
    "tool_output": res,
    "tool_use_id": d.get("tool_use_id") or "",
}))
')

result=$(mg_engine tool-output.sh "$payload")
replacement=$(mg_json "$result" replacement)

if [[ -z "$replacement" ]]; then
  printf '{}\n'
  exit 0
fi

printf '%s' "$replacement" | python3 -c '
import json, sys
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "updatedToolOutput": sys.stdin.read(),
    }
}))
'
