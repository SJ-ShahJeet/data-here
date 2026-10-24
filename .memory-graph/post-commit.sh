#!/bin/bash
# memory-graph: full graphify rebuild on git commit
# Installed to .git/hooks/post-commit by setup script.
# Re-extracts changed files (AST for code, LLM for docs/images if any).

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

# Rebuild code graph from AST
REPO_ROOT="$REPO_ROOT" python3 "$REPO_ROOT/.memory-graph/engine/graph-build.py" "$REPO_ROOT" >/dev/null 2>&1 || true

# Roll up session memory → <memory-graph home>/memory/state.yaml
COMPRESS="$REPO_ROOT/.memory-graph/engine/compress-memory.py"
if [ -f "$COMPRESS" ]; then
  REPO_ROOT="$REPO_ROOT" python3 "$COMPRESS" 2>/dev/null || true
fi
