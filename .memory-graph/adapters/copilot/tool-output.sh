#!/usr/bin/env bash
# GitHub Copilot postToolUse -> engine tool-output.
#
# In : {"toolName","toolResult":{"resultType","textResultForLlm"},"toolUseId"?}
# Out: {"modifiedResult":{"resultType":"success","textResultForLlm":"..."}}
#
# Copilot can replace the tool result, so this uses the engine's `replacement`.
# The previous version piped raw text into a script that expects JSON, so it
# always produced {} and compression never ran on Copilot at all.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

_input=$(cat)
[[ -n "$_input" ]] || { printf '{}\n'; exit 0; }

result_type=$(mg_json "$_input" toolResult.resultType)
if [[ "$result_type" == "error" ]]; then
  printf '{}\n'
  exit 0
fi

payload=$(printf '%s' "$_input" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    d = {}
tr = d.get("toolResult") or {}
if not isinstance(tr, dict):
    tr = {}
print(json.dumps({
    "tool_name": d.get("toolName") or "",
    "tool_output": tr.get("textResultForLlm") or "",
    "tool_use_id": d.get("toolUseId") or d.get("sessionId") or "",
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
    "modifiedResult": {
        "resultType": "success",
        "textResultForLlm": sys.stdin.read(),
    }
}))
'
