#!/usr/bin/env bash
# Claude Code PostToolUse (Edit|Write|MultiEdit|NotebookEdit) -> engine track-file.
#
# Claude has no dedicated "file was edited" event the way Cursor does, so file
# tracking rides on PostToolUse filtered by tool name in settings.json.
#
# In : {"tool_name","tool_input":{"file_path"|"notebook_path"},...}
# Out: {}
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

_input=$(cat)

file_path=$(mg_json "$_input" tool_input.file_path)
[[ -n "$file_path" ]] || file_path=$(mg_json "$_input" tool_input.notebook_path)
[[ -n "$file_path" ]] || file_path=$(mg_json "$_input" tool_input.path)

if [[ -z "$file_path" ]]; then
  printf '{}\n'
  exit 0
fi

payload=$(mg_emit "file_path=$file_path" "root=$MG_ROOT")
mg_engine track-file.sh "$payload" >/dev/null 2>&1 || true
printf '{}\n'
