// Pure state helpers for the v2 dashboard. No DOM, no React — everything the
// screens compute from `DashboardState` lives here so it can be unit-tested.
import { KINDS } from "./constants";
import type {
  Budget,
  DashboardData,
  Decay,
  EditorFilter,
  GraphNodeRow,
  InjectSettings,
  NodeKind,
  NodeStatus,
  OwnFact,
  QueueItem,
  Screen,
  Window,
} from "./types";

export type Resolution = "confirmed" | "rejected";

export interface Rect {
  t: number;
  l: number;
  w: number;
  h: number;
}

export interface DashboardState {
  screen: Screen;
  window: Window;
  session: number;
  filter: EditorFilter;
  /** Editor rows selected, keyed by node id. */
  selected: Record<string, true>;
  /** Queue items resolved this visit, keyed by id. */
  resolved: Record<string, Resolution>;
  /** Keyboard queueIndex in the review queue. */
  queueIndex: number;
  paletteOpen: boolean;
  paletteQuery: string;
  paletteIndex: number;
  setupStep: number;
  /** How many scan lines have been revealed. */
  scanLines: number;
  stackOff: Record<string, true>;
  stackExtra: { name: string; evidence: string }[];
  stackDraft: string;
  /** Proposal indexes unchecked during setup. */
  dropped: Record<number, true>;
  ownFacts: OwnFact[];
  /** Command string most recently copied, for the "copied" label. */
  copied: string;
  budget: Budget;
  kindsOff: Partial<Record<NodeKind, true>>;
  /** 0..100 — the injection weight floor ×100. */
  minWeight: number;
  decay: Decay;
  /** Status overrides applied from the editor, keyed by node id. */
  nodeStatus: Record<string, NodeStatus>;
  /** Editor rows removed by prune/merge, keyed by node id. */
  pruned: Record<string, true>;
  toast: string;
  tourOpen: boolean;
  tourStep: number;
  rect: Rect | null;
}

export const TOUR_SEEN_KEY = "mg2-tour-seen";

export function initialState(inject?: InjectSettings): DashboardState {
  const fromInject = inject ? injectToState(inject) : {};
  return {
    screen: "overview",
    window: "30d",
    session: 0,
    filter: "All",
    selected: {},
    resolved: {},
    queueIndex: 0,
    paletteOpen: false,
    paletteQuery: "",
    paletteIndex: 0,
    setupStep: 0,
    scanLines: 0,
    stackOff: {},
    stackExtra: [],
    stackDraft: "",
    dropped: {},
    ownFacts: [{ kind: "Constraint", text: "" }],
    copied: "",
    budget: "6k",
    kindsOff: {},
    minWeight: 30,
    decay: "30 days",
    nodeStatus: {},
    pruned: {},
    toast: "",
    tourOpen: false,
    tourStep: 0,
    rect: null,
    ...fromInject,
  };
}

// ---- Settings ↔ config -------------------------------------------------------
// The Settings screen shows four controls; the engine reads four config keys.
// These map between the two in both directions.


/** The four Settings controls as the state shape the screen renders. */
export function injectToState(inject: InjectSettings): Pick<DashboardState, "budget" | "kindsOff" | "minWeight" | "decay"> {
  const kindsOff: Partial<Record<NodeKind, true>> = {};
  for (const k of KINDS) if (!inject.kinds.includes(k)) kindsOff[k] = true;
  return {
    budget: inject.budget,
    kindsOff,
    minWeight: inject.minWeight,
    decay: inject.decay,
  };
}

/**
 * `inject_kinds` config value → the kinds it names. Comma list, trimmed,
 * matched case-insensitively, returned in canonical order; an empty or
 * fully-unrecognised value means "no restriction" — every kind.
 */
export function parseKinds(raw: string): NodeKind[] {
  const byLower = new Map(KINDS.map((k) => [k.toLowerCase(), k]));
  const named = new Set(
    raw
      .split(",")
      .map((k) => byLower.get(k.trim().toLowerCase()))
      .filter((k): k is NodeKind => k !== undefined),
  );
  if (named.size === 0) return KINDS.slice();
  return KINDS.filter((k) => named.has(k));
}

const BUDGET_TOKEN_STRINGS: Record<Budget, string> = { "2k": "2000", "6k": "6000", "12k": "12000", "No cap": "1000000" };
const DECAY_DAY_STRINGS: Record<Decay, string> = { Off: "0", "90 days": "90", "30 days": "30", "7 days": "7" };

/** The `inject_budget_tokens` value a Settings budget pill writes. */
export function budgetTokens(b: Budget): string {
  return BUDGET_TOKEN_STRINGS[b];
}

/** The `decay_half_life_days` value a Settings decay option writes. */
export function decayDays(d: Decay): string {
  return DECAY_DAY_STRINGS[d];
}

export const SCREEN_TITLES: Record<Screen, [string, string]> = {
  overview: ["Overview", "graph state"],
  sessions: ["Sessions", "what each run read, decided, left open"],
  editor: ["Graph editor", "curate before it gets injected"],
  fleet: ["Fleet", "this machine"],
  commands: ["Commands", "engine scripts"],
  settings: ["Settings", "what gets remembered and injected"],
  setup: ["Setup", ""],
};

/** Toggle a key in a set-like record, returning a new record. */
export function toggleKey<K extends string | number>(
  set: Partial<Record<K, true>>,
  key: K,
): Partial<Record<K, true>> {
  const next = { ...set };
  if (next[key]) delete next[key];
  else next[key] = true;
  return next;
}

/** Queue items that have not been confirmed or rejected this visit. */
export function liveQueue(queue: QueueItem[], resolved: DashboardState["resolved"]): QueueItem[] {
  return queue.filter((q) => !resolved[q.id]);
}

/** Keyboard position clamped to the live queue. */
export function clampCursor(index: number, liveCount: number): number {
  return Math.min(index, Math.max(0, liveCount - 1));
}

/** Editor rows after status overrides, prunes and the active filter. */
export function visibleNodes(nodes: GraphNodeRow[], s: DashboardState): GraphNodeRow[] {
  return nodes
    .map((n) => (s.nodeStatus[n.id] ? { ...n, status: s.nodeStatus[n.id] } : n))
    .filter((n) => !s.pruned[n.id])
    .filter((n) => {
      if (s.filter === "All") return true;
      if (s.filter === "Unreviewed") return n.status === "unreviewed";
      return n.kind === s.filter;
    });
}

/**
 * Merge plan for the selected rows: the heaviest survives, the rest fold into
 * it. Returns null when fewer than two rows are selected.
 */
export function mergePlan(
  nodes: GraphNodeRow[],
  selected: DashboardState["selected"],
): { keep: string; fold: string[] } | null {
  const keys = Object.keys(selected);
  if (keys.length < 2) return null;
  const weight = (id: string) => nodes.find((n) => n.id === id)?.weight ?? 0;
  const ranked = keys.slice().sort((a, b) => weight(b) - weight(a));
  return { keep: ranked[0], fold: ranked.slice(1) };
}

/** Nodes that clear the injection rules, per the design's estimate. */
export function injectedCount(nodeCount: number, kindsOffCount: number, minWeight: number): number {
  return Math.max(0, Math.round((nodeCount - kindsOffCount * 42) * (1 - minWeight / 140)));
}

/** Tokens per session for the summary line under the injection rules. */
export function budgetLabel(budget: Budget): string {
  return budget === "No cap" ? "7.9k" : budget;
}

/** Sparkline bar heights in px, 2..16, last bar highlighted by the caller. */
export function sparkHeights(vals: number[]): number[] {
  if (vals.length === 0) return [];
  const max = Math.max(...vals);
  return vals.map((v) => Math.max(2, Math.round((v / max) * 16)));
}

export interface PaletteEntry {
  group: "Go" | "Run" | "Filter" | "Set";
  label: string;
  hint: string;
  run: () => void;
}

export function filterPalette(entries: PaletteEntry[], query: string): PaletteEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => `${e.group} ${e.label}`.toLowerCase().includes(q));
}

export const TOUR_CARD_WIDTH = 360;
const TOUR_CARD_HEIGHT = 220;

/** Where the tour card sits relative to the ringed element. */
export function tourCardPosition(
  rect: Rect | null,
  vw: number,
  vh: number,
): { top: number; left: number; width: number } | null {
  if (!rect) return null;
  const width = Math.min(TOUR_CARD_WIDTH, vw - 32);
  const below = rect.t + rect.h + 18 + TOUR_CARD_HEIGHT < vh;
  const top = below ? rect.t + rect.h + 18 : Math.max(16, rect.t - 236);
  const left = Math.min(Math.max(16, rect.l), vw - width - 16);
  return { top, left, width };
}

export function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.t - b.t) < 1 &&
    Math.abs(a.l - b.l) < 1 &&
    Math.abs(a.w - b.w) < 1 &&
    Math.abs(a.h - b.h) < 1
  );
}

export function setupHint(
  step: number,
  scanDone: boolean,
  stackOnCount: number,
  keptCount: number,
  proposalTotal: number,
): string {
  return [
    scanDone ? `${proposalTotal} proposals ready` : "reading the repository…",
    `${stackOnCount} technologies in use`,
    `${keptCount} facts will enter the graph`,
    "You can add more any time",
  ][step];
}

export function nextLabel(step: number, scanDone: boolean): string {
  if (step === 3) return "Finish setup";
  if (step === 0 && !scanDone) return "Skip to results";
  return "Continue";
}

export function pluralNodes(n: number, verb: string): string {
  return `${n} ${n === 1 ? "node" : "nodes"} ${verb}`;
}

/** Recent sessions summary line used on the overview. */
export function sessionMeta(data: DashboardData, i: number): string {
  const s = data.sessions[i];
  // `when` is either a relative age ("2h", "3d") or an absolute date.
  const when = /^\d+[hdmw]$/.test(s.when) ? `${s.when} ago` : s.when;
  return `${s.id} · ${when} · ${s.read} read`;
}

/** Nodes whose weight fell below half of its start-of-window value. */
export function halvedCount(weights: DashboardData["weights"]): number {
  return weights.filter((w) => w.then > 0 && w.now < w.then / 2).length;
}

export function halvedNote(weights: DashboardData["weights"]): string {
  if (!weights.length) return "No weighted nodes yet — nodes appear after the first session with open items.";
  const n = halvedCount(weights);
  if (n === 0) return "No node lost more than half its weight this window.";
  return `${n === 1 ? "One node" : `${n} nodes`} lost more than half ${n === 1 ? "its" : "their"} weight this window.`;
}
