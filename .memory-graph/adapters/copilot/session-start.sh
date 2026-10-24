#!/usr/bin/env bash
# GitHub Copilot sessionStart -> engine session-start.
# Out: {"additionalContext": "..."}
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

_input=$(cat 2>/dev/null || true)
result=$(mg_engine session-start.sh '{}')
context=$(mg_json "$result" context)

if [[ -z "$context" ]]; then
  printf '{}\n'
  exit 0
fi

mg_emit "additionalContext=$context"
