#!/usr/bin/env bash
# memory-graph engine — session end.
#
# Neutral contract:
#   stdin : {"status": "completed|error|abort", "loop_count": 0, "transcript_path": "..."}
#   stdout: {}  or  {"followup": "<one-shot instruction for the agent>"}
#
# Fires when an agent finishes a turn. Only runs when project files changed —
# pure Q&A sessions produce no session file.
#
# What it does:
#   1. Guards against loops (only fires once per chat, only on clean completion)
#   2. Detects changed files via git diff and/or Cursor afterFileEdit ledger (MEMORY_TRACK)
#   3. Skips low-signal changes (<session_min_files files and no god-node blast radius)
#   4. Creates sessions/YYYY-MM-DD-N.md with structured YAML frontmatter (no prose template)
#   5. Appends a row to memory.md index
#   6. Rebuilds the code graph in background if code files changed (AST-only, no LLM)
#   7. Syncs god nodes into main.mdc from the refreshed graph
#   8. Compresses memory → memory/state.yaml on every file-changing stop (daily archive)
#   9. Optionally triggers semantic-compress via followup when auto enabled + caps hit
#  10. Exits silently — no followup unless semantic auto (avoids extra turns otherwise)

set -uo pipefail

_input=$(cat)

REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$REPO_ROOT"

source "$(dirname "${BASH_SOURCE[0]}")/mg_paths.sh"
mg_init_paths "$REPO_ROOT"

# Repo-relative forms, for text the agent reads and for the index links.
MEM_REL="${MG_MEMORY#$REPO_ROOT/}"
SESSIONS_REL="${MG_SESSIONS#$REPO_ROOT/}"

_semantic_sync_needed() {
  [[ "${MEMORY_SEMANTIC_AUTO:-}" == "1" ]] && return 0
  [[ -f "$REPO_ROOT/.memory-graph-semantic-auto" ]] && return 0
  [[ -f "$REPO_ROOT/.memory-graph/ollama.yaml" ]] && \
    grep -qE '^enabled:[[:space:]]*true' "$REPO_ROOT/.memory-graph/ollama.yaml" 2>/dev/null && return 0
  return 1
}

_agent_brief_enabled() {
  local cfg="$REPO_ROOT/.memory-graph/config.yaml"
  [[ -f "$cfg" ]] && grep -qE '^agent_brief:[[:space:]]*true' "$cfg" 2>/dev/null
}

_graph_scout_on_stop_enabled() {
  local cfg="$REPO_ROOT/.memory-graph/config.yaml"
  [[ -f "$cfg" ]] && grep -qE '^graph_scout_on_stop:[[:space:]]*true' "$cfg" 2>/dev/null && \
    grep -qE '^graph_scout_local:[[:space:]]*true' "$cfg" 2>/dev/null
}

_session_min_files() {
  python3 - "$REPO_ROOT" <<'PYEOF'
import sys; sys.path.insert(0, sys.argv[1] + "/.memory-graph/engine")
from mg_config import load_config; from pathlib import Path
print(load_config(Path(sys.argv[1])).get("session_min_files", 3))
PYEOF
}

_precompute_graph_scout() {
  local changed="$1"
  local scout_py="$REPO_ROOT/.memory-graph/engine/graph-scout-local.py"
  [[ -n "$changed" && -f "$scout_py" ]] || return 0
  _graph_scout_on_stop_enabled || return 0
  local query
  query=$(echo "$changed" | head -8 | tr '\n' ' ' | sed 's/  */ /g')
  [[ -n "$query" ]] || return 0
  REPO_ROOT="$REPO_ROOT" python3 "$scout_py" "$query" >/dev/null 2>&1 || true
}

_assemble_agent_brief() {
  local brief_py="$REPO_ROOT/.memory-graph/engine/assemble-agent-brief.py"
  [[ -f "$brief_py" ]] || return 0
  _agent_brief_enabled || return 0
  REPO_ROOT="$REPO_ROOT" python3 "$brief_py" >/dev/null 2>&1 || true
}

_ollama_context_on_start_enabled() {
  local cfg="$REPO_ROOT/.memory-graph/config.yaml"
  [[ -f "$cfg" ]] && grep -qE '^ollama_context_on_start:[[:space:]]*true' "$cfg" 2>/dev/null
}

_maybe_ollama_context_gateway() {
  local gw_py="$REPO_ROOT/.memory-graph/engine/ollama-context-gateway.py"
  [[ -f "$gw_py" ]] || return 0
  _ollama_context_on_start_enabled || return 0
  REPO_ROOT="$REPO_ROOT" python3 "$gw_py" >/dev/null 2>&1 || true
}

_ingest_memory_nodes() {
  local script="$REPO_ROOT/.memory-graph/engine/memory_nodes.py"
  [[ -f "$script" ]] || return 0
  REPO_ROOT="$REPO_ROOT" python3 "$script" ingest >/dev/null 2>&1 || true
}

_run_memory_compress() {
  local script="$REPO_ROOT/.memory-graph/engine/compress-memory.py"
  [[ -f "$script" ]] || return 0
  if _semantic_sync_needed || _agent_brief_enabled; then
    REPO_ROOT="$REPO_ROOT" python3 "$script" >/dev/null 2>&1 || true
  else
    ( REPO_ROOT="$REPO_ROOT" python3 "$script" > /dev/null 2>&1 ) &
  fi
}

_maybe_semantic_ollama() {
  local cfg="$REPO_ROOT/.memory-graph/ollama.yaml"
  local ollama_py="$REPO_ROOT/.memory-graph/engine/semantic-compress-ollama.py"
  [[ -f "$cfg" && -f "$ollama_py" ]] || return 1
  grep -qE '^enabled:[[:space:]]*true' "$cfg" 2>/dev/null || return 1
  [[ -f "$MG_MEMORY/.semantic-pending" ]] || return 1
  if REPO_ROOT="$REPO_ROOT" python3 "$ollama_py" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

_maybe_semantic_followup() {
  # Skip agent followup if Ollama handled compression this stop
  [[ -f "$MG_MEMORY/.semantic-pending" ]] || return 1
  [[ "${MEMORY_SEMANTIC_AUTO:-}" == "1" || -f "$REPO_ROOT/.memory-graph-semantic-auto" ]] || return 1

  local pending="$MG_MEMORY/.semantic-pending"
  [[ -f "$pending" ]] || return 1

  local reasons
  reasons=$(grep '^  - ' "$pending" 2>/dev/null | head -3 | tr '\n' ' ' | sed 's/  - //g')

  # Neutral key: adapters map `followup` onto their host's mechanism for asking
  # the agent to do one more thing (Cursor: followup_message; Claude: Stop hook
  # additionalContext; Copilot: additionalContext).
  cat <<JSON
{"followup": "Structural memory is full (${reasons}). Run the semantic-compress skill: distill \`${MEM_REL}/state.yaml\` + \`${SESSIONS_REL}/archive/\` into ≤15 lines in \`${MEM_REL}/state.yaml\`, drop resolved \`open\` items, then delete \`${MEM_REL}/.semantic-pending\` and write today's date to \`${MEM_REL}/.semantic-last-run\`. One pass only."}
JSON
  exit 0
}

_track_mode() {
  if [[ -n "${MEMORY_TRACK:-}" ]]; then
    echo "$MEMORY_TRACK"
    return
  fi
  local cfg="$REPO_ROOT/.memory-graph/config.yaml"
  if [[ -f "$cfg" ]]; then
    local t
    t=$(grep -E '^track:[[:space:]]*' "$cfg" 2>/dev/null | sed 's/^track:[[:space:]]*//' | tr -d ' "'\''')
    [[ -n "$t" ]] && { echo "$t"; return; }
  fi
  echo "auto"
}

# Drop memory-graph's own bookkeeping. Must cover every host directory, not just
# Cursor's — otherwise a Claude or Copilot session records the tool's own writes
# as project work and creates a session about itself.
_filter_internal_paths() {
  grep -v '^\.cursor/' \
    | grep -v '^\.claude/' \
    | grep -v '^\.github/' \
    | grep -v '^\.memory-graph/' \
    | grep -v '^sessions/' \
    | grep -v '^memory/' \
    | grep -v '^memory\.md$' \
    | grep -v '^CLAUDE\.md$' \
    | grep -v '^AGENTS\.md$' \
    | grep -v '^graphify-out/' \
    | grep -v '^$' || true
}

_git_changed_files() {
  git rev-parse --git-dir >/dev/null 2>&1 || return 0
  { git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null; } | sort -u
}

# Omit deletions — avoids bulk restructure noise in scope (180+ deleted root paths).
_git_changed_files_no_deletes() {
  git rev-parse --git-dir >/dev/null 2>&1 || return 0
  {
    git diff --diff-filter=d --name-only 2>/dev/null
    git diff --cached --diff-filter=d --name-only 2>/dev/null
  } | sort -u
}

_scope_max() {
  local cfg="$REPO_ROOT/.memory-graph/config.yaml"
  local max="${MEMORY_SCOPE_MAX:-40}"
  if [[ -f "$cfg" ]]; then
    local n
    n=$(grep -E '^scope_max:[[:space:]]*' "$cfg" 2>/dev/null | sed 's/^scope_max:[[:space:]]*//' | tr -d ' "'\''')
    [[ -n "$n" ]] && max="$n"
  fi
  echo "$max"
}

_git_noise_threshold() {
  local cfg="$REPO_ROOT/.memory-graph/config.yaml"
  local n="${MEMORY_GIT_NOISE_THRESHOLD:-25}"
  if [[ -f "$cfg" ]]; then
    local v
    v=$(grep -E '^git_noise_threshold:[[:space:]]*' "$cfg" 2>/dev/null | sed 's/^git_noise_threshold:[[:space:]]*//' | tr -d ' "'\''')
    [[ -n "$v" ]] && n="$v"
  fi
  echo "$n"
}

# Files the agent edited this session, as recorded by the track-file hook.
# Host-agnostic: every adapter writes to the same ledger.
_ledger_changed_files() {
  local ledger="$REPO_ROOT/.memory-graph/changed-files"
  [[ -f "$ledger" ]] || return 0
  sort -u "$ledger"
}

_collect_changed_files() {
  local mode ledger_files
  mode="$(_track_mode)"

  case "$mode" in
    git)
      _git_changed_files | _filter_internal_paths
      ;;
    ledger|cursor)  # `cursor` kept as an alias for pre-split configs
      _ledger_changed_files | _filter_internal_paths
      ;;
    auto|*)
      ledger_files=$(_ledger_changed_files)
      if [[ -n "$ledger_files" ]]; then
        # Session-scoped: agent edits only — not whole dirty working tree.
        printf '%s\n' "$ledger_files" | _filter_internal_paths
      else
        # No agent edits this chat — do not fall back to git diff (avoids 200+ file
        # sessions when the working tree is dirty but the agent did not touch those
        # files). Use track: git if you explicitly want git-diff-based sessions.
        :
      fi
      ;;
  esac
}

_clear_change_ledger() {
  rm -f "$REPO_ROOT/.memory-graph/changed-files" 2>/dev/null || true
}

_finish() {
  local changed="${1:-}"
  _precompute_graph_scout "$changed"
  _clear_change_ledger
  _ingest_memory_nodes
  _run_memory_compress
  _assemble_agent_brief
  if _maybe_semantic_ollama; then
    _assemble_agent_brief
  fi
  _maybe_ollama_context_gateway
  _maybe_semantic_followup
  printf '{}'
  exit 0
}

# ── 1. Loop guard — only fire once per chat, only on clean completion ───────
TRANSCRIPT_PATH=""
if command -v jq >/dev/null 2>&1; then
  LOOP_COUNT="$(printf '%s' "$_input" | jq -r '.loop_count // 0' 2>/dev/null || echo 0)"
  STATUS="$(printf '%s' "$_input" | jq -r '.status // "completed"' 2>/dev/null || echo completed)"
  TRANSCRIPT_PATH="$(printf '%s' "$_input" | jq -r '.transcript_path // empty' 2>/dev/null || true)"
  if [[ "$LOOP_COUNT" -ge 1 || "$STATUS" != "completed" ]]; then
    printf '{}'
    exit 0
  fi
else
  LOOP_COUNT=0
  STATUS=completed
fi

# ── 2. Detect changed files (git and/or Cursor ledger — see MEMORY_TRACK) ───
raw_changed=$(_collect_changed_files)

if [ -z "$raw_changed" ]; then
  printf '{}'
  exit 0
fi

file_count=$(echo "$raw_changed" | wc -l | tr -d ' ')

# ── 3. Graph impact (for god-node gating + session prefill) ───────────────────
god_nodes_hit=""
graph_facts=""
export CHANGED_FILES="$raw_changed"
if [ -f "$MG_GRAPH_DIR/graph.json" ] && command -v python3 >/dev/null 2>&1; then
  eval "$(REPO_ROOT="$REPO_ROOT" CHANGED_FILES="$raw_changed" python3 "$REPO_ROOT/.memory-graph/engine/graph-blast.py" 2>/dev/null || true)"
  god_nodes_hit="${GOD_NODES_HIT:-}"
  graph_facts="${GRAPH_FACTS:-}"
fi

# ── 4. Smart gate — skip low-signal sessions (<session_min_files files, no god-node hit) ────
# Computed before the gate, not inside it. Step 9 below reads has_code on the
# path where a session IS written — assigning it only in the skip branch left it
# unbound there, and under `set -u` that killed the script right after the
# session file was created, silently skipping the graph rebuild and the brief.
code_exts='\.py$|\.ts$|\.tsx$|\.js$|\.jsx$|\.go$|\.rs$|\.java$|\.cpp$|\.c$|\.rb$|\.swift$|\.kt$|\.cs$|\.scala$|\.php$'
has_code=$(echo "$raw_changed" | grep -E "$code_exts" | head -1 || true)

min_files=$(_session_min_files)
if [ "$file_count" -lt "$min_files" ] && [ -z "$god_nodes_hit" ]; then
  # Still run graph build in background if code changed, but no session file
  if [ -n "$has_code" ]; then
    ( REPO_ROOT="$REPO_ROOT" python3 "$REPO_ROOT/.memory-graph/engine/graph-build.py" "$REPO_ROOT" > /dev/null 2>&1 ) &
  fi
  _finish "$raw_changed"
fi

# ── 5. Build session file path (YYYY-MM-DD-N.md — N resets each day) ────────
today=$(date +%Y-%m-%d)
now=$(date +%H:%M)
mkdir -p "$MG_SESSIONS"
existing=0
existing=$(ls "$MG_SESSIONS/${today}"-*.md 2>/dev/null | wc -l | tr -d ' ') || existing=0
session_num=$((existing + 1))
session_file="$MG_SESSIONS/${today}-${session_num}.md"
# Index links are relative to memory.md, which sits beside sessions/ in either layout.
session_link="$(basename "$MG_SESSIONS")/${today}-${session_num}.md"

# Skip if session already has context filled
if [ -f "$session_file" ]; then
  has_context=$(grep -E '^context: ".+"' "$session_file" 2>/dev/null | wc -l | tr -d ' ') || has_context=0
  if [ "$has_context" -gt 0 ]; then
    _finish "$raw_changed"
  fi
fi

# ── 6. Derive topic hints ────────────────────────────────────────────────────
scope_max=$(_scope_max)
scoped_changed=$(echo "$raw_changed" | head -n "$scope_max")
files_yaml=$(echo "$scoped_changed" | awk '{print "  - " $0}')

topics=$(echo "$scoped_changed" | awk -F'/' '
  {
    if (NF >= 3) label = $2 "/" $3
    else if (NF == 2) label = $2
    else label = $1
    seen[label] = 1
  }
  END {
    n = 0
    for (k in seen) { keys[n++] = k }
    out = ""
    for (i = 0; i < n && i < 5; i++) {
      out = (out == "") ? keys[i] : out ", " keys[i]
    }
    print out
  }
' || true)

# God nodes YAML list
god_nodes_yaml="  []"
if [ -n "$god_nodes_hit" ]; then
  god_nodes_yaml=$(echo "$god_nodes_hit" | awk -F', ' '{print "  - " $1}' | head -5)
fi

facts_block=""
if [ -n "$graph_facts" ]; then
  facts_block="facts:
$(echo "$graph_facts" | sed 's/^/  /')"
else
  facts_block="facts: []"
fi

_fill_session_from_transcript() {
  local session="$1"
  local transcript="$2"
  local fill_py="$REPO_ROOT/.memory-graph/engine/fill-session-from-transcript.py"
  [[ -f "$fill_py" && -f "$session" && -n "$transcript" && -f "$transcript" ]] || return 0
  REPO_ROOT="$REPO_ROOT" python3 "$fill_py" "$session" "$transcript" >/dev/null 2>&1 || true
}

# ── 7. Write structured session file (frontmatter only — no prose sections) ─
cat > "$session_file" <<TEMPLATE
---
date: ${today}
time: ${now}
session: ${session_num}
topics: "${topics}"
scope:
${files_yaml}
god_nodes_touched:
${god_nodes_yaml}
open: []
blocked: []
context: ""
why: ""
outcome: ""
${facts_block}
---
TEMPLATE

_fill_session_from_transcript "$session_file" "$TRANSCRIPT_PATH"

# ── 8. Append row to memory.md ──────────────────────────────────────────────
new_row="| ${today} ${now} | ${session_num} | ${topics} | ${file_count} files | [view](${session_link}) |"

mkdir -p "$(dirname "$MG_INDEX")"
if ! grep -q "| Date/Time |" "$MG_INDEX" 2>/dev/null; then
  cat > "$MG_INDEX" <<MEMEOF
# Session Memory Index

> Auto-maintained by memory-graph. Structured context lives in \`${SESSIONS_REL}/\` frontmatter.

| Date/Time | Session | Topics | Files | Session File |
|-----------|---------|--------|-------|--------------|
${new_row}
MEMEOF
else
  echo "$new_row" >> "$MG_INDEX"
fi

# ── 9. Code-graph rebuild + main.mdc codebase summary (ledger-triggered) ─
if [ -n "$has_code" ]; then
  (
    REPO_ROOT="$REPO_ROOT" python3 "$REPO_ROOT/.memory-graph/engine/graph-build.py" "$REPO_ROOT" > /dev/null 2>&1
    SUMMARY_PY="$REPO_ROOT/.memory-graph/engine/graph-summary-main.py"
    if [ -f "$SUMMARY_PY" ]; then
      REPO_ROOT="$REPO_ROOT" python3 "$SUMMARY_PY" >/dev/null 2>&1 || true
    fi
  ) &
fi

# ── 10. Optional gstack context-save (no followup) ───────────────────────────
if command -v gstack-context-save >/dev/null 2>&1; then
  (gstack-context-save > /dev/null 2>&1 ) &
fi

_finish "$raw_changed"
