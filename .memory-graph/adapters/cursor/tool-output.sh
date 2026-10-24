#!/usr/bin/env bash
# Cursor postToolUse -> engine tool-output.
# Out: {"additional_context": "..."}
#
# Cursor's postToolUse can add context but not replace the tool result, so this
# adapter uses the engine's `context` field. Claude and Copilot use `replacement`
# instead and get the larger saving.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

_input=$(cat)
[[ -n "$_input" ]] || { printf '{}\n'; exit 0; }

result=$(mg_engine tool-output.sh "$_input")
context=$(mg_json "$result" context)

if [[ -z "$context" ]]; then
  printf '{}\n'
  exit 0
fi

mg_emit "additional_context=$context"
