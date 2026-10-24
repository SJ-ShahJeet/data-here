// Turns a scanned `DashboardState` into the `DashboardData` shape the v2
// screens render — the real counterpart to `lib/v2/sample.ts`.
import path from "path";
import type { DashboardState, MemoryNode } from "@/lib/scan";
import type { ConfigValue } from "@/lib/mg-config";
import { parseKinds } from "./logic";
import { COMMANDS } from "./commands";
import { TOUR } from "./constants";
import type {
  Budget,
  DashboardData,
  Decay,
  GraphNodeRow,
  InjectSettings,
  KindCount,
  Metric,
  NodeKind,
  NodeStatus,
  QueueItem,
  Session,
  SessionRead,
  WeightRow,
} from "./types";

const NODE_KINDS: NodeKind[] = [
  "Decision",
  "Constraint",
  "Open thread",
  "Dependency",
  "Test/CI fact",
];

const NODE_STATUSES: NodeStatus[] = ["confirmed", "unreviewed", "pinned", "stale"];

/** Maps an engine-supplied kind string onto the five kinds the UI knows. */
function toKind(k: string): NodeKind {
  return (NODE_KINDS as string[]).includes(k) ? (k as NodeKind) : "Open thread";
}

/** Maps an engine-supplied status string onto the four statuses the UI knows. */
function toStatus(s: string): NodeStatus {
  return (NODE_STATUSES as string[]).includes(s) ? (s as NodeStatus) : "unreviewed";
}

/** A node still in play — not folded into another node, thrown out or pruned. */
function isLive(n: MemoryNode): boolean {
  return n.status !== "rejected" && n.status !== "merged_into" && n.status !== "pruned";
}

/** A config value as a finite number, or the fallback (mirrors the engine's `_number`). */
function cfgNumber(v: ConfigValue | undefined, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim()) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Clamp `n` to the closed range [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** The `inject_budget_tokens` config value as the pill label Settings shows. */
function budgetFromConfig(cfg: Record<string, ConfigValue>): Budget {
  const tokens = cfgNumber(cfg.inject_budget_tokens, 6000);
  if (tokens <= 2000) return "2k";
  if (tokens <= 6000) return "6k";
  if (tokens <= 12000) return "12k";
  return "No cap";
}

/** The `decay_half_life_days` config value as the option label Settings shows. */
function decayFromConfig(cfg: Record<string, ConfigValue>): Decay {
  const days = cfgNumber(cfg.decay_half_life_days, 30);
  if (days === 0) return "Off";
  if (days >= 90) return "90 days";
  if (days >= 30) return "30 days";
  return "7 days";
}

/**
 * The injection settings the engine will actually apply, read from the same
 * config it reads and from the ids the last brief injected.
 */
export function injectFromConfig(cfg: Record<string, ConfigValue>, injectedCount: number): InjectSettings {
  const raw = typeof cfg.inject_kinds === "string" ? cfg.inject_kinds : "";
  return {
    budget: budgetFromConfig(cfg),
    kinds: parseKinds(raw),
    minWeight: clamp(Math.round(cfgNumber(cfg.inject_min_weight, 0.3) * 100), 0, 100),
    decay: decayFromConfig(cfg),
    injectedCount,
  };
}

/** Compact magnitude for a count, e.g. 1234 → "1.2k", 4900000 → "4.9M". */
function fmtCompact(n: number): string {
  if (n === 0) return "0";
  if (n < 1000) return String(Math.round(n));
  const k = n / 1e3;
  // Values that would round up to "1000.0k" belong in the M range.
  if (k < 999.95) return k.toFixed(1) + "k";
  return (n / 1e6).toFixed(1) + "M";
}

/** A session's start as "YYYY-MM-DDTHH:MM", comparable with the brief's ISO stamp. */
function sessionStart(date: string, time: string): string {
  return `${date}T${time || "00:00"}`;
}

/**
 * Which session read the last brief. The brief is written when a session ends,
 * so its nodes were read by the first session that started after that —
 * i.e. the oldest of the sessions newer than the brief. Comparison is on
 * local "date time" against the brief's ISO minute; close enough for a receipt.
 */
function readerIndex(state: DashboardState): number {
  const at = state.nodes.injected_at.slice(0, 16);
  if (!at || !state.nodes.injected.length) return -1;
  let found = -1;
  state.sessions.items.forEach((s, i) => {
    if (sessionStart(s.date, s.time) > at) found = i;
  });
  return found;
}

/** A 0..1 fraction as a rounded percentage string. */
function fmtPct(f: number): string {
  return Math.round(f * 100) + "%";
}

/** The config profile as a word; a trailing `# comment` in config.yaml is not part of it. */
function profileName(state: DashboardState): string {
  return String(state.settings.profile).split("#")[0].trim() || "standard";
}

export function fromState(state: DashboardState): DashboardData {
  const repo = state.repo;
  const profile = profileName(state);
  const sessionCount = state.sessions.count;
  const liveNodes = state.nodes.nodes.filter(isLive);
  const nodeCount = liveNodes.length;
  const unreviewedCount = liveNodes.filter((n) => n.status === "unreviewed").length;
  const reviewedCount = liveNodes.filter((n) => n.status === "confirmed" || n.status === "pinned").length;
  const reviewedFraction = liveNodes.length ? reviewedCount / liveNodes.length : 0;

  const queue: QueueItem[] = liveNodes
    .filter((n) => n.status === "unreviewed")
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .map((n) => ({
      id: n.id,
      kind: toKind(n.kind),
      meta: `weight ${n.weight.toFixed(2)} · last seen ${n.last_seen}`,
      claim: n.claim,
      source: `from ${n.source_session}`,
    }));

  const weights: WeightRow[] = liveNodes
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map((n) => ({
      label: n.claim,
      kind: toKind(n.kind),
      now: n.weight,
      then: n.base_weight,
    }));

  const kinds: KindCount[] = NODE_KINDS.map((kind) => ({
    kind,
    count: liveNodes.filter((n) => toKind(n.kind) === kind).length,
  }));

  const nodes: GraphNodeRow[] = liveNodes.map((n) => ({
    id: n.id,
    claim: n.claim,
    path: n.source_session,
    kind: toKind(n.kind),
    weight: n.weight,
    seen: n.last_seen,
    status: toStatus(n.status),
  }));

  const metrics: Metric[] = [
    { label: "Sessions", value: String(state.sessions.count), note: "in this repo", spark: [], accent: true },
    { label: "Nodes", value: String(nodeCount), note: `${unreviewedCount} unreviewed`, spark: [] },
    { label: "Reviewed", value: liveNodes.length ? fmtPct(reviewedFraction) : "—", note: "confirmed or pinned", spark: [] },
    { label: "Context hit rate", value: "—", note: "not measured yet", spark: [] },
    { label: "Tokens saved", value: fmtCompact(state.compression.total_saved), note: "tool output compression", spark: [] },
  ];

  const byId = new Map(state.nodes.nodes.map((n) => [n.id, n]));

  const reader = readerIndex(state);
  const sessions: Session[] = state.sessions.items.map((s, i) => {
    const base = path.basename(s.file);
    const id = base.replace(/\.md$/, "");
    const wrote = state.nodes.nodes.filter((n) => path.basename(n.source_session) === base).length;

    let reads: SessionRead[] = [];
    if (i === reader) {
      reads = state.nodes.injected
        .map((nid) => byId.get(nid))
        .filter((n): n is MemoryNode => Boolean(n))
        .map((n) => ({ kind: toKind(n.kind), text: n.claim }));
    }

    return {
      id,
      when: s.date,
      title: s.topics || base,
      read: reads.length,
      wrote,
      stamp: `${s.date} ${s.time}`,
      summary: s.context,
      reads,
      decided: s.context ? [s.context] : [],
      open: [...s.open, ...s.blocked.map((b) => "blocked: " + b)],
      injected: "—",
      saved: "—",
      duration: "—",
    };
  });

  const repos = [
    {
      name: repo,
      stack: profile,
      nodes: nodeCount,
      coverage: reviewedFraction,
      saved: fmtCompact(state.compression.total_saved),
      unreviewed: unreviewedCount,
      self: true,
    },
  ];

  const fleet = {
    repos: 1,
    saved: fmtCompact(state.compression.total_saved),
    medianCoverage: fmtPct(reviewedFraction),
    unreviewed: unreviewedCount,
  };

  return {
    repo,
    daemon: `${repo} · scanned ${state.generated_at.slice(11, 16)}Z`,
    connection: `${repo} · local index · profile ${profile}`,
    sessionCount,
    nodeCount,
    metrics,
    queue,
    weights,
    kinds,
    sessions,
    nodes,
    repos,
    fleet,
    commands: COMMANDS,
    scan: [
      { text: "$ bash setup --agent=all", tone: "cmd" },
      { text: "setup scan is not wired to the engine yet", tone: "dim" },
    ],
    scanDuration: "—",
    stack: [],
    proposals: [],
    tour: TOUR,
    inject: injectFromConfig(state.settings.config, state.nodes.injected.length),
  };
}
