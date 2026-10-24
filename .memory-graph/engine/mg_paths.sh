#!/usr/bin/env bash
# memory-graph path registry — the shell mirror of mg_config.py's layout section.
#
# Everything memory-graph owns lives under .memory-graph/, so adopting the tool
# costs a repo one entry rather than eight. Repos installed before the
# consolidation still keep that data at the top level, and the engine reads
# either — upgrading alone never orphans someone's memory.
#
# Usage:
#   source "$ROOT/.memory-graph/engine/mg_paths.sh"
#   mg_init_paths "$ROOT"
#   ... then use $MG_MEMORY / $MG_SESSIONS / $MG_GRAPH_DIR / $MG_INDEX
#
# Keep the names here in sync with OWNED_PATHS in mg_config.py.

MG_HOME_DIR=".memory-graph"

# The paths whose presence tells us which layout a repo is on. scripts/ and
# dashboard/ are deliberately excluded — plenty of projects have their own
# scripts/ at the root, and mistaking it for ours would drag the whole repo back
# to the legacy layout.
MG_LAYOUT_MARKERS="memory sessions graphify-out memory.md"

# mg_is_legacy_layout <root> — true when the data still sits at the repo root.
#
# One decision for the whole repo, deliberately. Resolving each path on its own
# lets a repo end up half-migrated — sessions/ at the root while state.yaml goes
# into the new home — which breaks every link in the index. The consolidated
# home wins as soon as it holds any marker, so a part-way migration lands on the
# new layout rather than straddling both.
mg_is_legacy_layout() {
  local root="$1" rel
  for rel in $MG_LAYOUT_MARKERS; do
    [[ -e "$root/$MG_HOME_DIR/$rel" ]] && return 1
  done
  for rel in $MG_LAYOUT_MARKERS; do
    [[ -e "$root/$rel" ]] && return 0
  done
  return 1
}

# mg_init_paths <root> — export the resolved paths for this repo.
mg_init_paths() {
  local root="$1" base
  if mg_is_legacy_layout "$root"; then
    base="$root"
  else
    base="$root/$MG_HOME_DIR"
  fi

  MG_HOME="$root/$MG_HOME_DIR"
  MG_BASE="$base"
  MG_MEMORY="$base/memory"
  MG_SESSIONS="$base/sessions"
  MG_GRAPH_DIR="$base/graphify-out"
  MG_INDEX="$base/memory.md"
  export MG_HOME MG_BASE MG_MEMORY MG_SESSIONS MG_GRAPH_DIR MG_INDEX
}
