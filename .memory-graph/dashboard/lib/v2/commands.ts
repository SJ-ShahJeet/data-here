// The commands screen for a real `DashboardData`: actual memory-graph engine
// commands, not the fictional `memgraph` CLI the sample data was drawn with.
import type { CommandSection } from "./types";

const section = (title: string, note: string, rows: [string, string, string][]): CommandSection => ({
  title,
  note,
  items: rows.map(([cmd, desc, flags]) => ({ cmd, desc, flags })),
});

export const COMMANDS: CommandSection[] = [
  section("Install", "one directory per repo", [
    ["bash setup --agent=all", "Install engine, adapters and hooks into .memory-graph/.", "--agent=claude|cursor|copilot"],
  ]),
  section("Memory nodes", "what the brief injects", [
    ["python3 .memory-graph/engine/memory_nodes.py ingest", "Turn session open/blocked/facts into nodes in memory/nodes.json.", "REPO_ROOT=<path>"],
    ["python3 .memory-graph/engine/memory_nodes.py decay", "Apply half-life decay to unreviewed node weights.", "decay_half_life_days in config.yaml"],
  ]),
  section("Brief", "what the model receives", [
    ["python3 .memory-graph/engine/assemble-agent-brief.py", "Rebuild memory/.agent-brief.yaml from state, nodes and god nodes.", "inject_budget_tokens  inject_kinds  inject_min_weight"],
    ["python3 .memory-graph/engine/compress-memory.py", "Roll sessions into memory/state.yaml, archive, decay nodes.", "MEMORY_ARCHIVE_MODE=age"],
  ]),
  section("Graph", "code structure", [
    ["python3 .memory-graph/engine/graph-build.py .", "Rebuild the AST code graph (no LLM).", ""],
    ['bash scripts/graph-scout-local.sh "<query>"', "Answer a structural question from the graph.", "graph_scout_budget"],
  ]),
  section("Test", "keep it honest", [
    ["bash scripts/test.sh", "Static checks, dashboard vitest, engine unittest, sandbox.", ""],
    ["npm --prefix dashboard run dev", "Run this dashboard locally.", "-- -p 3000"],
  ]),
];
