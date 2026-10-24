// Static display constants shared by every v2 data provider — sample and real
// alike — so a provider only has to produce the numbers, not the colours or
// the tour copy.
import type { NodeKind, TourStep } from "./types";

export const ACCENT = "#e8b23a";

/** Colour per node kind. */
export const KIND_COLOR: Record<NodeKind, string> = {
  Decision: "#97ead2",
  Constraint: "#ee4266",
  "Open thread": "#f5879b",
  Dependency: "#7fb5c9",
  "Test/CI fact": "#c9a76a",
};

export const KINDS = Object.keys(KIND_COLOR) as NodeKind[];

export const TOUR: TourStep[] = [
  { screen: "overview", target: null, title: "This is the graph for your repo",
    body: "Memory Graph keeps what your coding sessions learn. Ninety seconds and you will know where everything lives. Press ⌘K at any point to jump." },
  { screen: "overview", target: "stats", title: "Five numbers, one line",
    body: "Reviewed is the one to watch — anything unconfirmed is still noise the model has to carry." },
  { screen: "overview", target: "queue", title: "Nodes a run wrote, nobody checked",
    body: "This is the work. J and K move between rows, C confirms, R rejects — or use the buttons." },
  { screen: "overview", target: "weights", title: "Weight is how much a node earns its place",
    body: "The bar is now, the tick is 30 days ago. Bars short of their tick are going stale." },
  { screen: "sessions", target: "session", title: "Every run leaves a receipt",
    body: "What it read, what it decided, what it left open. Open threads are the cheapest thing to pick up next session." },
  { screen: "editor", target: "editorbar", title: "Curate before it reaches the model",
    body: "Select rows, then Pin, Merge or Prune. The bulk bar only appears when something is selected." },
  { screen: "commands", target: null, title: "Everything here has a command",
    body: "The dashboard is a view onto the engine scripts — setup, ingest, decay, brief, graph, tests." },
  { screen: "settings", target: "inject", title: "Decide what the model receives",
    body: "Budget, node types, weight floor. Too high and the graph forgets; too low and you pay for noise." },
  { screen: "overview", target: null, title: "That is the whole thing",
    body: "The hooks build this as you work: every session that changes files leaves nodes behind, and you decide which ones the model keeps." },
];
