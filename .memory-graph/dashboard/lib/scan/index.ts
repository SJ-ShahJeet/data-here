import path from "path";
import { isoUtc } from "./iso-utc";
import { freshness } from "./freshness";
import type { Freshness, FreshnessState } from "./freshness";
import { pipeline } from "./pipeline";
import type { Pipeline, PipelineCheck } from "./pipeline";
import { graphFreshness } from "./graph-freshness";
import type { GraphFreshness } from "./graph-freshness";
import { settings } from "./settings";
import type { Settings } from "./settings";
import { stateYaml } from "./state";
import type { StateYaml } from "./state";
import { sessions } from "./sessions";
import type { Sessions, SessionItem } from "./sessions";
import { graph } from "./graph";
import type { Graph, GraphNode, GraphLink } from "./graph";
import { tiers } from "./tiers";
import type { Tiers } from "./tiers";
import { agents } from "./agents";
import type { Agents, AgentHost } from "./agents";
import { compression } from "./compression";
import type { Compression, CompressionEntry } from "./compression";
import { nodes } from "./nodes";
import type { Nodes, MemoryNode } from "./nodes";

export interface DashboardState {
  generated_at: string;
  repo: string;
  freshness: Freshness;
  pipeline: Pipeline;
  graph_freshness: GraphFreshness;
  settings: Settings;
  state: StateYaml;
  sessions: Sessions;
  graph: Graph;
  tiers: Tiers;
  agents: Agents;
  compression: Compression;
  nodes: Nodes;
}

export function collect(root: string): DashboardState {
  const generated_at = isoUtc(Date.now());
  const repo = path.basename(path.resolve(root));

  return {
    generated_at,
    repo,
    freshness: freshness(root),
    pipeline: pipeline(root),
    graph_freshness: graphFreshness(root),
    settings: settings(root),
    state: stateYaml(root),
    sessions: sessions(root),
    graph: graph(root),
    tiers: tiers(root),
    agents: agents(root),
    compression: compression(root),
    nodes: nodes(root),
  };
}

// Barrel re-exports for app code
export { isoUtc } from "./iso-utc";
export { freshness } from "./freshness";
export type { Freshness, FreshnessState } from "./freshness";
export { pipeline } from "./pipeline";
export type { Pipeline, PipelineCheck } from "./pipeline";
export { graphFreshness } from "./graph-freshness";
export type { GraphFreshness } from "./graph-freshness";
export { settings } from "./settings";
export type { Settings } from "./settings";
export { stateYaml } from "./state";
export type { StateYaml } from "./state";
export { sessions } from "./sessions";
export type { Sessions, SessionItem } from "./sessions";
export { graph } from "./graph";
export type { Graph, GraphNode, GraphLink } from "./graph";
export { tiers } from "./tiers";
export type { Tiers } from "./tiers";
export { agents } from "./agents";
export type { Agents, AgentHost } from "./agents";
export { compression } from "./compression";
export type { Compression, CompressionEntry } from "./compression";
export { nodes } from "./nodes";
export type { Nodes, MemoryNode } from "./nodes";
