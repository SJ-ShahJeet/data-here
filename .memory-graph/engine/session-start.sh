#!/usr/bin/env bash
# memory-graph engine — session start.
#
# Neutral contract:
#   stdin : ignored (adapters may pass their host payload; it is not needed here)
#   stdout: {"context": "<text to inject>"}  or  {}
#
# Read-only, no LLM. Adapters translate the `context` key into whatever their
# host expects (Cursor: additional_context, Claude: hookSpecificOutput.additionalContext,
# Copilot: additionalContext).
set -euo pipefail

ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
source "$(dirname "${BASH_SOURCE[0]}")/mg_paths.sh"
mg_init_paths "$ROOT"

CFG="$MG_HOME/config.yaml"
BRIEF="$MG_MEMORY/.agent-brief.yaml"
STATE="$MG_MEMORY/state.yaml"

# Repo-relative memory dir, so the "do not read this again" hints below name the
# path this repo actually uses rather than assuming one layout.
MEM_REL="${MG_MEMORY#$ROOT/}"
SESSIONS_REL="${MG_SESSIONS#$ROOT/}"

# Gateway cache. `.context.yaml` is the current name; `.cursor-context.yaml` is
# read as a fallback so repos installed before the multi-host split keep working.
CONTEXT="$MG_MEMORY/.context.yaml"
[[ -f "$CONTEXT" ]] || CONTEXT="$MG_MEMORY/.cursor-context.yaml"

_cfg_true() {
  local key="$1"
  [[ -f "$CFG" ]] && grep -qE "^${key}:[[:space:]]*true" "$CFG" 2>/dev/null
}

_inject() {
  local file="$1"
  local max_chars="$2"
  local preamble="$3"
  python3 - "$file" "$max_chars" "$preamble" <<'PYEOF'
import json, sys
from pathlib import Path

path = Path(sys.argv[1])
max_chars = int(sys.argv[2])
preamble = sys.argv[3]
text = path.read_text(encoding="utf-8", errors="replace").strip()
if len(text) > max_chars:
    text = text[:max_chars] + "\n# ... (truncated for sessionStart injection)"
print(json.dumps({"context": preamble + text}))
PYEOF
}

# Token-first: prefer precomputed Ollama gateway context (~1200 chars)
if _cfg_true "ollama_context_on_start" && [[ -f "$CONTEXT" ]]; then
  _inject "$CONTEXT" 1200 \
    "memory-graph: slim context below. Do NOT read ${MEM_REL}/state.yaml, ${SESSIONS_REL}/, or graph scout."$'\n\n'
  exit 0
fi

# Fallback when gateway enabled but cache missing: truncated state.yaml
if _cfg_true "ollama_context_on_start" && [[ -f "$STATE" ]]; then
  _inject "$STATE" 1200 \
    "memory-graph: working memory below (gateway cache missing). Do NOT read ${SESSIONS_REL}/."$'\n\n'
  exit 0
fi

# Merged agent brief (state + optional scout)
if _cfg_true "agent_brief" && [[ -f "$BRIEF" ]]; then
  _inject "$BRIEF" 1800 \
    "memory-graph: project context below. Do NOT also read ${MEM_REL}/state.yaml or ${MEM_REL}/.graph-scout.yaml separately."$'\n\n'
  exit 0
fi

printf '{}\n'
