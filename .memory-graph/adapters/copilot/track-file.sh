#!/usr/bin/env bash
# GitHub Copilot postToolUse (any tool) -> engine track-file.
# Records file paths for editing tools only; reads and shell calls are ignored.
#
# In : {"toolName","toolArgs":{"path"|"filePath"},...}
# Out: {}
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

_input=$(cat)

tool_name=$(mg_json "$_input" toolName)
file_path=$(mg_json "$_input" toolArgs.path)
[[ -n "$file_path" ]] || file_path=$(mg_json "$_input" toolArgs.filePath)

if [[ -z "$file_path" ]]; then
  printf '{}\n'
  exit 0
fi

case "$tool_name" in
  *edit*|*Edit*|*write*|*Write*|*create*|*Create*|*replace*|*Replace*|*insert*|*Insert*) ;;
  *) printf '{}\n'; exit 0 ;;
esac

payload=$(mg_emit "file_path=$file_path" "root=$MG_ROOT")
mg_engine track-file.sh "$payload" >/dev/null 2>&1 || true
printf '{}\n'
