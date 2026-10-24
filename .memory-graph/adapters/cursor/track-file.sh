#!/usr/bin/env bash
# Cursor afterFileEdit -> engine track-file.
# Cursor's payload {file_path, workspace_roots[]} is accepted by the engine
# directly, so this is a pass-through.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

_input=$(cat)
[[ -n "$_input" ]] || exit 0

mg_engine track-file.sh "$_input" >/dev/null 2>&1 || true
exit 0
