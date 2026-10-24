#!/usr/bin/env bash
# Upgrade an existing memory-graph install — hooks, scripts, and .agents only.
#
# Preserves user data: memory/, sessions/, memory.md, .memory-graph/config.yaml,
# .memory-graph/ollama.yaml, .cursor/rules/, .cursor/hooks.json, graphify-out/
#
# Usage:
#   cd /your/project
#   bash scripts/upgrade-memory-graph.sh                         # usual (after first upgrade)
#   bash memory-graph/scripts/upgrade-memory-graph.sh            # dev layout (nested toolkit/)
#   bash /path/to/memory-graph/scripts/upgrade-memory-graph.sh . # run from toolkit clone
#   bash scripts/upgrade-memory-graph.sh --migrate-layout        # move to the one-folder layout
#
# First time (no saved toolkit path yet):
#   MEMORY_GRAPH_SOURCE=/path/to/memory-graph bash scripts/upgrade-memory-graph.sh
#
# Env:
#   MEMORY_GRAPH_SOURCE  — toolkit root (optional; saved to .memory-graph/toolkit-source)
#   DRY_RUN=1            — print actions, do not copy

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
DRY_RUN="${DRY_RUN:-0}"
MIGRATE_LAYOUT=0

args=()
for arg in "$@"; do
  case "$arg" in
    --migrate-layout) MIGRATE_LAYOUT=1 ;;
    *) args+=("$arg") ;;
  esac
done

TARGET="${args[0]:-$(pwd)}"
TARGET=$(cd "$TARGET" && pwd)

fail() { echo "error: $1" >&2; exit 1; }
info() { echo "[upgrade] $*"; }
warn() { echo "[warn] $*" >&2; }

_is_toolkit_root() {
  local root=$1
  [[ -f "$root/.memory-graph/engine/session-end.sh" ]]
}

_resolve_source() {
  local target=${1:-}
  local candidate src

  if [[ -n "${MEMORY_GRAPH_SOURCE:-}" ]]; then
    src=$(cd "$MEMORY_GRAPH_SOURCE" && pwd)
    _is_toolkit_root "$src" || fail "MEMORY_GRAPH_SOURCE has no hooks: $src"
    echo "$src"
    return
  fi

  # Script lives in <toolkit>/scripts/ — toolkit adjacent to this script
  candidate=$(cd "$SCRIPT_DIR/.." && pwd)
  if _is_toolkit_root "$candidate" && [[ "$candidate" != "$target" ]]; then
    echo "$candidate"
    return
  fi

  # Dev layout: installed at project root, toolkit kept in memory-graph/
  if [[ -n "$target" ]] && _is_toolkit_root "$target/memory-graph"; then
    cd "$target/memory-graph" && pwd
    return
  fi

  # Last successful upgrade (per-repo, gitignored)
  if [[ -n "$target" && -f "$target/.memory-graph/toolkit-source" ]]; then
    src=$(cd "$(tr -d '[:space:]' < "$target/.memory-graph/toolkit-source")" && pwd)
    if _is_toolkit_root "$src"; then
      echo "$src"
      return
    fi
    warn "ignored stale .memory-graph/toolkit-source (not a toolkit): $src"
  fi

  # Common global install locations
  for candidate in \
    "${HOME}/.cursor/skills/memory-graph" \
    "${HOME}/.agents/skills/memory-graph"; do
    if _is_toolkit_root "$candidate"; then
      echo "$(cd "$candidate" && pwd)"
      return
    fi
  done

  fail "Could not find toolkit source. Run once with:
  MEMORY_GRAPH_SOURCE=/path/to/memory-graph bash scripts/upgrade-memory-graph.sh"
}

_save_toolkit_source() {
  local source=$1
  [[ "$DRY_RUN" == "1" ]] && return
  mkdir -p "$TARGET/.memory-graph"
  printf '%s\n' "$source" > "$TARGET/.memory-graph/toolkit-source"
}

_is_installed() {
  local root=$1
  [[ -f "$root/.memory-graph/engine/session-end.sh" ]] || \
  [[ -f "$root/.memory-graph/engine/compress-memory.py" ]] || \
  { [[ -f "$root/post-commit.sh" ]] && [[ -d "$root/.memory-graph" ]]; }
}

_copy_file() {
  local src=$1 dest=$2
  if [[ "$DRY_RUN" == "1" ]]; then
    info "would copy: ${dest#"$TARGET"/}"
    return
  fi
  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
}

_copy_tree() {
  local src_dir=$1 dest_dir=$2
  if [[ ! -d "$src_dir" ]]; then
    return
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    find "$src_dir" -type f \
      ! -path '*/__pycache__/*' ! -name '*.pyc' \
      | while read -r f; do
      info "would copy: ${dest_dir#"$TARGET"/}/${f#"$src_dir"/}"
    done
    return
  fi
  mkdir -p "$dest_dir"
  find "$src_dir" -type f \
    ! -path '*/__pycache__/*' ! -name '*.pyc' \
    | while read -r f; do
    local rel="${f#"$src_dir"/}"
    mkdir -p "$dest_dir/$(dirname "$rel")"
    cp "$f" "$dest_dir/$rel"
  done
}

# scripts/ moved into .memory-graph/ with the layout consolidation; a repo that
# has not migrated yet still keeps it at the root.
_target_scripts_dir() {
  if [[ -d "$TARGET/.memory-graph/scripts" ]]; then
    echo "$TARGET/.memory-graph/scripts"
  else
    echo "$TARGET/scripts"
  fi
}

_chmod_hooks_and_scripts() {
  [[ "$DRY_RUN" == "1" ]] && return
  chmod +x "$TARGET/setup" "$TARGET/post-commit.sh" "$TARGET/.memory-graph/post-commit.sh" 2>/dev/null || true
  find "$TARGET/.memory-graph/engine" -type f \( -name '*.sh' -o -name '*.py' \) -exec chmod +x {} + 2>/dev/null || true
  find "$(_target_scripts_dir)" -type f -name '*.sh' -exec chmod +x {} + 2>/dev/null || true
}

# ── Layout migration ────────────────────────────────────────────────────────
# memory-graph used to install eight things at the repo root. Everything it
# owns now lives in .memory-graph/. The engine reads either layout, so this is
# opt-in: run it when you want the root cleaned up, not as a side effect of an
# upgrade.
_git_tracked() {
  git -C "$TARGET" rev-parse --git-dir >/dev/null 2>&1 || return 1
  [[ -n "$(git -C "$TARGET" ls-files -- "$1" 2>/dev/null | head -1)" ]]
}

_move_into_home() {
  local rel="$1"
  local src="$TARGET/$rel"
  local dest="$TARGET/.memory-graph/$rel"

  [[ -e "$src" ]] || return 0
  if [[ -e "$dest" ]]; then
    warn "$rel exists in both places — merge by hand, then delete $rel"
    return 0
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    warn "would move $rel → .memory-graph/$rel"
    return 0
  fi

  mkdir -p "$(dirname "$dest")"
  # git mv keeps the file history attached; plain mv for anything untracked.
  if _git_tracked "$rel"; then
    git -C "$TARGET" mv "$rel" ".memory-graph/$rel" 2>/dev/null || mv "$src" "$dest"
  else
    mv "$src" "$dest"
  fi
  info "moved $rel → .memory-graph/$rel"
}

_migrate_gitignore() {
  local gi="$TARGET/.gitignore"
  [[ -f "$gi" ]] || return 0
  grep -q '^\.memory-graph/sessions/' "$gi" && return 0
  if [[ "$DRY_RUN" == "1" ]]; then
    warn "would add .memory-graph/ ignore rules to .gitignore"
    return 0
  fi
  cat >> "$gi" <<'GIEOF'

# memory-graph, consolidated layout. The pre-consolidation rules above stay so
# a repo part-way through the move keeps both places ignored.
.memory-graph/sessions/
.memory-graph/memory.md
.memory-graph/memory/state.yaml
.memory-graph/memory/.semantic-last-run
.memory-graph/graphify-out/
.memory-graph/dashboard/node_modules/
.memory-graph/dashboard/.next/
GIEOF
  info "added .memory-graph/ rules to .gitignore"
}

_migrate_post_commit_hook() {
  local hook="$TARGET/.git/hooks/post-commit"
  [[ -f "$hook" ]] || return 0
  grep -q '\.memory-graph/post-commit\.sh' "$hook" && return 0
  if [[ "$DRY_RUN" == "1" ]]; then
    warn "would repoint .git/hooks/post-commit at .memory-graph/post-commit.sh"
    return 0
  fi
  # Rewrite the memory-graph line to resolve either location, so the hook keeps
  # firing whether or not post-commit.sh has moved yet.
  python3 - "$hook" <<'PYEOF'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
replacement = (
    'r=$(git rev-parse --show-toplevel)\n'
    'h="$r/.memory-graph/post-commit.sh"; [ -f "$h" ] || h="$r/post-commit.sh"\n'
    'if [ -f "$h" ]; then bash "$h"; fi'
)
new = re.sub(r'^.*post-commit\.sh.*$', replacement, text, count=1, flags=re.M)
path.write_text(new, encoding="utf-8")
PYEOF
  info "repointed .git/hooks/post-commit at the new location"
}

_migrate_layout() {
  if [[ ! -d "$TARGET/.memory-graph" ]]; then
    fail "no .memory-graph/ in $TARGET — nothing to migrate into"
  fi

  info "migrating $TARGET to the one-folder layout"
  for rel in memory sessions graphify-out memory.md scripts dashboard post-commit.sh; do
    _move_into_home "$rel"
  done
  _migrate_gitignore
  _migrate_post_commit_hook

  echo ""
  info "Done. Everything memory-graph owns is now under .memory-graph/"
  echo ""
  echo "Still at the repo root, because their host reads them from there:"
  echo "  CLAUDE.md  AGENTS.md  .gitignore"
  echo "  .claude/settings.json  .cursor/  .github/hooks/"
}

if [[ "$MIGRATE_LAYOUT" == "1" ]]; then
  _migrate_layout
  exit 0
fi

SOURCE=$(_resolve_source "$TARGET")

if [[ "$SOURCE" == "$TARGET" ]]; then
  fail "Source and target are the same ($TARGET). Add a memory-graph/ toolkit subfolder or set MEMORY_GRAPH_SOURCE."
fi

if ! _is_installed "$TARGET"; then
  echo "No memory-graph install detected in $TARGET" >&2
  echo "Run full setup instead:" >&2
  echo "  bash \"$SOURCE/setup\"" >&2
  exit 1
fi

info "source: $SOURCE"
info "target: $TARGET"
[[ "$DRY_RUN" == "1" ]] && warn "DRY_RUN=1 — no files will change"

# ── Migration: pre-1.2 installs kept the engine inside .cursor/hooks/ ───────
# Those files are dead once the new engine lands, and leaving them behind means
# a stale copy that no host calls but everyone finds confusing.
if [[ -d "$TARGET/.cursor/hooks" ]]; then
  if [[ "$DRY_RUN" == "1" ]]; then
    warn "would remove legacy .cursor/hooks/ (engine now lives in .memory-graph/engine/)"
  else
    rm -rf "$TARGET/.cursor/hooks"
    info "removed legacy .cursor/hooks/ — engine moved to .memory-graph/engine/"
  fi
fi
if [[ -d "$TARGET/scripts/adapters" ]]; then
  if [[ "$DRY_RUN" == "1" ]]; then
    warn "would remove legacy scripts/adapters/"
  else
    rm -rf "$TARGET/scripts/adapters"
    info "removed legacy scripts/adapters/ — now .memory-graph/adapters/"
  fi
fi
# Gateway cache files were renamed when they stopped being Cursor-specific.
for pair in ".cursor-context.yaml:.context.yaml" \
            ".cursor-context-meta:.context-meta" \
            ".cursor-context-status:.context-status"; do
  old="${pair%%:*}"; new="${pair##*:}"
  if [[ -f "$TARGET/memory/$old" && ! -f "$TARGET/memory/$new" && "$DRY_RUN" != "1" ]]; then
    mv "$TARGET/memory/$old" "$TARGET/memory/$new"
    info "renamed memory/$old → memory/$new"
  fi
done

# ── Code: engine + adapters ─────────────────────────────────────────────────
if [[ -d "$SOURCE/.memory-graph/engine" ]]; then
  _copy_tree "$SOURCE/.memory-graph/engine" "$TARGET/.memory-graph/engine"
  info "updated .memory-graph/engine/"
fi
if [[ -d "$SOURCE/.memory-graph/adapters" ]]; then
  _copy_tree "$SOURCE/.memory-graph/adapters" "$TARGET/.memory-graph/adapters"
  info "updated .memory-graph/adapters/"
fi

# ── Code: project scripts ───────────────────────────────────────────────────
# Copy upgrade-memory-graph.sh last — bash reads this file incrementally; overwriting
# it mid-run causes parse errors on macOS bash 3.2.
if [[ -d "$SOURCE/scripts" ]]; then
  find "$SOURCE/scripts" -type f \
    ! -path '*/__pycache__/*' ! -name '*.pyc' ! -name 'upgrade-memory-graph.sh' \
    | while read -r f; do
    rel="${f#"$SOURCE/scripts"/}"
    _copy_file "$f" "$(_target_scripts_dir)/$rel"
  done
  info "updated $(_target_scripts_dir | sed "s|^$TARGET/||")/"
fi

# ── Code: root executables ──────────────────────────────────────────────────
for f in setup post-commit.sh; do
  if [[ -f "$SOURCE/$f" ]]; then
    _copy_file "$SOURCE/$f" "$TARGET/$f"
    info "updated $f"
  fi
done

# ── Code: docs + example configs (not live config) ──────────────────────────
if [[ -d "$SOURCE/docs" ]]; then
  _copy_tree "$SOURCE/docs" "$TARGET/docs"
  info "updated docs/"
fi

mkdir -p "$TARGET/.memory-graph"
for f in config.example.yaml ollama.example.yaml; do
  if [[ -f "$SOURCE/.memory-graph/$f" ]]; then
    _copy_file "$SOURCE/.memory-graph/$f" "$TARGET/.memory-graph/$f"
    info "updated .memory-graph/$f"
  fi
done

# ── Agents: skills only ─────────────────────────────────────────────────────
if [[ -d "$SOURCE/.agents" ]]; then
  _copy_tree "$SOURCE/.agents" "$TARGET/.agents"
  info "updated .agents/"
fi

# ── Host wiring: only refresh hosts this repo already uses ──────────────────
# Upgrading must not silently opt a repo into an agent it never chose. Use
# `bash setup --agent=<name>` to add one.
if [[ -f "$TARGET/.cursor/hooks.json" ]]; then
  _copy_file "$SOURCE/.cursor/hooks.json" "$TARGET/.cursor/hooks.json"
  info "updated .cursor/hooks.json"
fi

if [[ -d "$TARGET/.claude" || -f "$TARGET/CLAUDE.md" ]]; then
  if [[ "$DRY_RUN" == "1" ]]; then
    warn "would merge memory-graph hooks into .claude/settings.json"
  else
    mkdir -p "$TARGET/.claude"
    SRC_JSON="$SOURCE/.claude/settings.json" DEST_JSON="$TARGET/.claude/settings.json" python3 - <<'PY'
import json, os

src, dest = os.environ["SRC_JSON"], os.environ["DEST_JSON"]
with open(src) as f:
    ours = json.load(f)
try:
    with open(dest) as f:
        existing = json.load(f)
except Exception:
    existing = {}

hooks = existing.setdefault("hooks", {})
for event, entries in ours.get("hooks", {}).items():
    bucket = hooks.setdefault(event, [])
    # Replace any previously installed memory-graph entry so path changes land,
    # while leaving the user's own hooks alone.
    bucket[:] = [
        e for e in bucket
        if "memory-graph/adapters" not in json.dumps(e)
    ]
    bucket.extend(entries)

with open(dest, "w") as f:
    json.dump(existing, f, indent=2)
    f.write("\n")
PY
    info "updated .claude/settings.json (memory-graph hooks only)"
  fi
fi

if [[ -d "$TARGET/.github/hooks" ]]; then
  _copy_tree "$SOURCE/.github/hooks" "$TARGET/.github/hooks"
  info "updated .github/hooks/"
  if [[ -f "$SOURCE/.github/copilot-instructions.md" ]]; then
    _copy_file "$SOURCE/.github/copilot-instructions.md" "$TARGET/.github/copilot-instructions.md"
    info "updated .github/copilot-instructions.md"
  fi
fi

_chmod_hooks_and_scripts

if [[ -f "$SOURCE/scripts/upgrade-memory-graph.sh" ]]; then
  _copy_file "$SOURCE/scripts/upgrade-memory-graph.sh" "$(_target_scripts_dir)/upgrade-memory-graph.sh"
  info "updated upgrade-memory-graph.sh"
fi

_save_toolkit_source "$SOURCE"

echo ""
info "Done — upgraded code + .agents + .github/hooks in $TARGET"
echo ""
echo "Preserved (not touched):"
echo "  memory/  sessions/  memory.md"
echo "  .memory-graph/config.yaml  .memory-graph/ollama.yaml"
echo "  .cursor/rules/  graphify-out/"
echo "  your own hooks in .claude/settings.json"
echo ""
if [[ -d "$TARGET/memory" || -d "$TARGET/sessions" || -d "$TARGET/graphify-out" ]]; then
  echo "This repo still keeps memory-graph's data at the root. To move it all"
  echo "into one folder (the engine reads either layout, so this is optional):"
  echo "  bash $(_target_scripts_dir | sed "s|^$TARGET/||")/upgrade-memory-graph.sh --migrate-layout"
  echo ""
fi

echo "Add an agent this repo does not use yet:"
echo "  bash setup --agent=claude|cursor|copilot"
echo ""
echo "Optional: bash scripts/test.sh"
