#!/usr/bin/env bash
# Cursor stop -> engine session-end.
# Cursor's native payload already matches the neutral contract, so this is close
# to a pass-through; the only translation is followup -> followup_message.
# Out: {} | {"followup_message": "..."}
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

_input=$(cat)
[[ -n "$_input" ]] || _input='{}'

result=$(mg_engine session-end.sh "$_input")
followup=$(mg_json "$result" followup)

if [[ -z "$followup" ]]; then
  printf '{}\n'
  exit 0
fi

mg_emit "followup_message=$followup"
