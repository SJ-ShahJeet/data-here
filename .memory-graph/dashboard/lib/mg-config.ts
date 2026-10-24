/**
 * Unified memory-graph config loader, ported from .memory-graph/engine/mg_config.py.
 *
 * This is the SINGLE SANCTIONED LOCATION for host path literals under dashboard/.
 * Host paths must NEVER appear in any other dashboard/ file (rule R9).
 * This file is duplicated from .memory-graph/engine/mg_config.py per decision #2.
 */

import fs from "fs";
import path from "path";
import { parseSimpleYaml, stripQuotes } from "./yaml";

// ── Host registry ────────────────────────────────────────────────────────────
// The single place that knows anything about specific agents. Engine code asks
// this module which hosts are installed and where their briefs live; it never
// hardcodes a host path itself. Adding a host = one entry here + one adapter.
export interface HostSpec {
  brief: string;
  marker: string;
  internal: readonly string[];
}

export const HOSTS: Readonly<Record<string, HostSpec>> = Object.freeze({
  cursor: Object.freeze({
    brief: ".cursor/rules/main.mdc",
    marker: ".cursor/hooks.json",
    internal: Object.freeze([".cursor/"]),
  }),
  claude: Object.freeze({
    brief: "CLAUDE.md",
    marker: ".claude/settings.json",
    internal: Object.freeze([".claude/"]),
  }),
  copilot: Object.freeze({
    brief: ".github/copilot-instructions.md",
    marker: ".github/hooks/memory-graph.json",
    internal: Object.freeze([".github/"]),
  }),
});

// ── Layout ───────────────────────────────────────────────────────────────────
// Ported from the same section of mg_config.py — keep the two in step.
//
// memory-graph installs into exactly one directory. Everything it owns lives
// under HOME_DIR, so adopting the tool costs a repo one entry rather than
// eight. Repos installed before the consolidation still keep that data at the
// top level, so every lookup prefers the consolidated home and falls back to
// the legacy path when that is what exists.
export const HOME_DIR = ".memory-graph";

export const OWNED_PATHS: Readonly<Record<string, string>> = Object.freeze({
  memory: "memory",
  sessions: "sessions",
  graph: "graphify-out",
  index: "memory.md",
  scripts: "scripts",
  dashboard: "dashboard",
});

function exists(p: string): boolean {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

export function mgHome(root: string): string {
  return path.join(root, HOME_DIR);
}

// The paths whose presence tells us which layout a repo is on. `scripts` and
// `dashboard` are deliberately excluded — plenty of projects have their own
// scripts/ at the root, and mistaking it for ours would drag the whole repo
// back to the legacy layout.
export const LAYOUT_MARKERS: readonly string[] = Object.freeze([
  "memory",
  "sessions",
  "graphify-out",
  "memory.md",
]);

/**
 * True when this repo still keeps memory-graph's data at the top level.
 *
 * One decision for the whole repo, deliberately — resolving each path on its
 * own lets a repo end up half-migrated, with sessions/ at the root while
 * state.yaml goes into the new home, which breaks every link in the index. The
 * consolidated home wins as soon as it holds any of these, so a part-way
 * migration lands on the new layout rather than straddling both.
 */
export function isLegacyLayout(root: string): boolean {
  if (LAYOUT_MARKERS.some((rel) => exists(path.join(root, HOME_DIR, rel)))) return false;
  return LAYOUT_MARKERS.some((rel) => exists(path.join(root, rel)));
}

/** Absolute path for one of memory-graph's own files or directories. */
export function mgPath(root: string, name: keyof typeof OWNED_PATHS): string {
  const base = isLegacyLayout(root) ? root : path.join(root, HOME_DIR);
  return path.join(base, OWNED_PATHS[name]);
}

export const memoryDir = (root: string) => mgPath(root, "memory");
export const sessionsDir = (root: string) => mgPath(root, "sessions");
export const graphDir = (root: string) => mgPath(root, "graph");
export const graphJson = (root: string) => path.join(graphDir(root), "graph.json");
// Beside sessions/ by construction, so the index's relative links always resolve.
export const memoryIndex = (root: string) => mgPath(root, "index");

// Paths memory-graph writes itself. Edits to these must never create a session,
// or the tool records its own bookkeeping as project work and loops. The
// consolidated layout is covered by the `.memory-graph/` prefix alone; the bare
// names stay listed so repos still on the legacy layout are filtered too.
const uniqueInternal = Array.from(
  new Set(Object.values(HOSTS).flatMap((spec) => spec.internal))
).sort();

export const INTERNAL_PREFIXES: readonly string[] = Object.freeze([
  ...uniqueInternal,
  ".memory-graph/",
  "sessions/",
  "graphify-out/",
  "memory/",
] as const);

export const INTERNAL_FILES: ReadonlySet<string> = new Set([
  "memory.md",
  "CLAUDE.md",
  "AGENTS.md",
]) as unknown as ReadonlySet<string>;

export function isInternalPath(relPath: string): boolean {
  const trimmed = relPath.trim();
  // Strip leading "./" sequences (but keep dots that are part of the actual path)
  let rel = trimmed;
  while (rel.startsWith("./") || rel.startsWith("/")) {
    if (rel.startsWith("./")) {
      rel = rel.slice(2);
    } else if (rel.startsWith("/")) {
      rel = rel.slice(1);
    }
  }

  if (!rel) return true;
  if (INTERNAL_FILES.has(rel)) return true;
  return INTERNAL_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

export function installedHosts(root: string): string[] {
  return Object.entries(HOSTS)
    .filter(([, spec]) => {
      const markerPath = path.join(root, spec.marker);
      try {
        return fs.statSync(markerPath).isFile();
      } catch {
        return false;
      }
    })
    .map(([name]) => name);
}

// ── Configuration ────────────────────────────────────────────────────────────

export type ConfigValue = string | number | boolean;

export const DEFAULTS: Readonly<Record<string, ConfigValue>> = {
  profile: "standard",
  track: "auto",
  git_noise_threshold: 25,
  scope_max: 40,
  session_fill_from_transcript: true,
  session_context_max_chars: 600,
  archive_why_fields: true,
  archive_enrich_on_move: true,
  archive_monthly_summary: true,
  graph_summary_on_stop: true,
  session_min_files: 3,
  graph_scout_local: false,
  graph_scout_budget: 500,
  graph_scout_summarize: false,
  graph_scout_on_stop: true,
  agent_brief: true,
  agent_brief_max_lines: 45,
  // Memory-node injection (mirrors engine/mg_config.py).
  inject_budget_tokens: 6000,
  inject_kinds: "Decision,Constraint,Open thread,Dependency,Test/CI fact",
  inject_min_weight: 0.3,
  decay_half_life_days: 30,
  tool_output_compress: true,
  tool_output_min_chars: 6000,
  tool_output_max_summary: 1200,
  ollama_context_on_start: false,
  ollama_context_max_lines: 15,
  ollama_context_cache_mins: 30,
  ollama_context_max_chars: 1200,
  enabled: false,
  host: "http://127.0.0.1:11434",
  model: "llama3.2:3b",
  max_archive_chars: 12000,
  max_archive_files: 2,
  timeout: 120,
  temperature: 0.0,
};

export const PROFILE_PRESETS: Readonly<
  Record<"minimal" | "standard" | "token-first", Readonly<Record<string, boolean>>>
> = Object.freeze({
  minimal: Object.freeze({
    agent_brief: false,
    tool_output_compress: false,
    ollama_context_on_start: false,
    graph_scout_local: false,
    graph_scout_on_stop: false,
    session_fill_from_transcript: true,
  }),
  standard: Object.freeze({
    agent_brief: true,
    tool_output_compress: true,
    ollama_context_on_start: false,
    graph_scout_local: false,
    graph_scout_on_stop: true,
    session_fill_from_transcript: true,
  }),
  "token-first": Object.freeze({
    agent_brief: true,
    tool_output_compress: true,
    ollama_context_on_start: true,
    graph_scout_local: false,
    graph_scout_on_stop: false,
    session_fill_from_transcript: true,
  }),
});

function coerceValue(raw: string): ConfigValue {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "").replace(/^['"]|['"]$/g, "");
  const lower = trimmed.toLowerCase();

  if (lower === "true" || lower === "yes") return true;
  if (lower === "false" || lower === "no") return false;

  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number(trimmed);

  return trimmed;
}

function parseYamlSections(
  text: string
): [string | null, Record<string, ConfigValue>, Record<string, ConfigValue>, Record<string, ConfigValue>] {
  let profile: string | null = null;
  const flat: Record<string, ConfigValue> = {};
  const core: Record<string, ConfigValue> = {};
  const ollama: Record<string, ConfigValue> = {};
  let section: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes(":")) continue;

    if (line[0] !== " " && line[0] !== "\t") {
      const colonIdx = trimmed.indexOf(":");
      const key = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();

      if ((key === "core" || key === "ollama") && !val) {
        section = key;
      } else {
        section = null;
        if (key === "profile") {
          profile = String(coerceValue(val));
        } else {
          flat[key] = coerceValue(val);
        }
      }
    } else if (section === "core" || section === "ollama") {
      const colonIdx = trimmed.indexOf(":");
      const key = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();

      if (section === "core") {
        core[key] = coerceValue(val);
      } else {
        ollama[key] = coerceValue(val);
      }
    }
  }

  return [profile, flat, core, ollama];
}

export function loadConfig(root: string): Record<string, ConfigValue> {
  const cfg: Record<string, ConfigValue> = { ...DEFAULTS };
  const configPath = path.join(root, ".memory-graph", "config.yaml");

  let profileName: string | null = null;
  const flat: Record<string, ConfigValue> = {};
  const core: Record<string, ConfigValue> = {};
  let ollamaSec: Record<string, ConfigValue> = {};

  try {
    const text = fs.readFileSync(configPath, "utf-8");
    const [pn, f, c, o] = parseYamlSections(text);
    profileName = pn;
    Object.assign(flat, f);
    Object.assign(core, c);
    Object.assign(ollamaSec, o);
  } catch {
    // Config file doesn't exist or can't be read
  }

  if (profileName && profileName in PROFILE_PRESETS) {
    const preset = PROFILE_PRESETS[profileName as "minimal" | "standard" | "token-first"];
    Object.assign(cfg, preset);
  }

  cfg.profile = profileName || cfg.profile || "standard";
  Object.assign(cfg, core, flat, ollamaSec);

  // Legacy .memory-graph/ollama.yaml overlay
  try {
    const legacyPath = path.join(root, ".memory-graph", "ollama.yaml");
    const legacyText = fs.readFileSync(legacyPath, "utf-8");
    for (const line of legacyText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes(":")) continue;
      const colonIdx = trimmed.indexOf(":");
      const key = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1);
      cfg[key] = coerceValue(val);
    }
  } catch {
    // Legacy file doesn't exist
  }

  if ("enabled" in cfg) {
    cfg.ollama_enabled = Boolean(cfg.enabled);
  }

  return cfg;
}
