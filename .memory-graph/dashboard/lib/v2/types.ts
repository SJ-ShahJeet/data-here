// Data model for the v2 dashboard (Memory Graph Dashboard v2 design).
//
// Everything the screens render is described here. `lib/v2/sample.ts` ships
// the sample data the design was drawn with; a real provider only has to
// produce a `DashboardData` and the UI does not change.

export type NodeKind =
  | "Decision"
  | "Constraint"
  | "Open thread"
  | "Dependency"
  | "Test/CI fact";

export type NodeStatus = "confirmed" | "unreviewed" | "pinned" | "stale";

export type Screen =
  | "overview"
  | "sessions"
  | "editor"
  | "fleet"
  | "commands"
  | "settings"
  | "setup";

export type Window = "7d" | "30d" | "90d";
export type Budget = "2k" | "6k" | "12k" | "No cap";
export type Decay = "Off" | "90 days" | "30 days" | "7 days";
export type EditorFilter = "All" | "Unreviewed" | NodeKind;

export interface Metric {
  label: string;
  value: string;
  note: string;
  /** Raw series; the last point is highlighted. */
  spark: number[];
  /** Highlight the value in the accent colour. */
  accent?: boolean;
}

export interface QueueItem {
  id: string;
  kind: NodeKind;
  meta: string;
  claim: string;
  source: string;
}

export interface WeightRow {
  label: string;
  kind: NodeKind;
  /** Weight now, 0..1. */
  now: number;
  /** Weight at the start of the window, 0..1 (the tick mark). */
  then: number;
}

export interface KindCount {
  kind: NodeKind;
  count: number;
}

export interface SessionRead {
  kind: NodeKind;
  text: string;
}

export interface Session {
  id: string;
  /** Relative age, e.g. "2h". */
  when: string;
  title: string;
  read: number;
  wrote: number;
  stamp: string;
  summary: string;
  reads: SessionRead[];
  decided: string[];
  open: string[];
  injected: string;
  saved: string;
  duration: string;
}

export interface GraphNodeRow {
  /** Store id, what `POST /api/nodes` is addressed with. */
  id: string;
  claim: string;
  path: string;
  kind: NodeKind;
  weight: number;
  seen: string;
  status: NodeStatus;
}

export interface Repo {
  name: string;
  stack: string;
  nodes: number;
  /** 0..1 */
  coverage: number;
  saved: string;
  unreviewed: number;
  /** The repository this dashboard is showing. */
  self?: boolean;
}

export interface FleetTotals {
  repos: number;
  saved: string;
  medianCoverage: string;
  unreviewed: number;
}

export interface Command {
  cmd: string;
  desc: string;
  flags: string;
}

export interface CommandSection {
  title: string;
  note: string;
  items: Command[];
}

export type ScanTone = "cmd" | "dim" | "hit" | "ok" | "";

export interface ScanLine {
  text: string;
  tone: ScanTone;
}

export interface StackItem {
  name: string;
  evidence: string;
}

export interface Proposal {
  claim: string;
  evidence: string;
  kind: NodeKind;
}

export interface OwnFact {
  kind: NodeKind;
  text: string;
}

export interface TourStep {
  screen: Screen;
  /** `data-tour` attribute of the element to ring, or null for a centred card. */
  target: string | null;
  title: string;
  body: string;
}

/** A `POST /api/nodes` review action — see that route for what each does. */
export type NodeAction = "confirm" | "reject" | "pin" | "prune" | "merge";

/** The injection settings as currently configured — what Settings shows and writes. */
export interface InjectSettings {
  budget: Budget;
  kinds: NodeKind[];
  minWeight: number;
  decay: Decay;
  /** How many nodes the last brief actually injected. */
  injectedCount: number;
}

export interface DashboardData {
  repo: string;
  /** Shown in the sidebar footer, e.g. "daemon live · 4m". */
  daemon: string;
  /** Shown under Settings → Connection. */
  connection: string;
  sessionCount: number;
  nodeCount: number;
  metrics: Metric[];
  queue: QueueItem[];
  weights: WeightRow[];
  kinds: KindCount[];
  sessions: Session[];
  nodes: GraphNodeRow[];
  repos: Repo[];
  fleet: FleetTotals;
  commands: CommandSection[];
  scan: ScanLine[];
  scanDuration: string;
  stack: StackItem[];
  proposals: Proposal[];
  tour: TourStep[];
  /** What Settings shows and writes. Every current provider populates it. */
  inject: InjectSettings;
}
