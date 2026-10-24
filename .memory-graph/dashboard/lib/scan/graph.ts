import fs from "fs";
import { graphJson } from "@/lib/mg-config";

export interface GraphNode {
  id: string;
  label: string;
  community: unknown;
  type: string;
  degree: number;
  betweenness: number | null;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface Graph {
  present: boolean;
  node_count: number;
  link_count: number;
  truncated: boolean;
  nodes: GraphNode[];
  links: GraphLink[];
}

function endpoint(v: unknown): string {
  if (v && typeof v === "object" && "id" in v) {
    return String((v as { id: unknown }).id);
  }
  return String(v);
}

export function graph(root: string, limit: number = 200): Graph {
  const graphPath = graphJson(root);

  let data: unknown;
  try {
    const text = fs.readFileSync(graphPath, "utf-8");
    data = JSON.parse(text);
  } catch {
    return { present: false, node_count: 0, link_count: 0, truncated: false, nodes: [], links: [] };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { present: false, node_count: 0, link_count: 0, truncated: false, nodes: [], links: [] };
  }

  const rawNodes = (data as Record<string, unknown>).nodes ?? [];
  const rawLinks = (data as Record<string, unknown>).links ?? [];

  if (!Array.isArray(rawNodes) || !Array.isArray(rawLinks)) {
    return { present: false, node_count: 0, link_count: 0, truncated: false, nodes: [], links: [] };
  }

  // Calculate degrees
  const degree: Record<string, number> = {};

  for (const link of rawLinks) {
    if (!link || typeof link !== "object") continue;
    const source = endpoint((link as Record<string, unknown>).source);
    const target = endpoint((link as Record<string, unknown>).target);
    degree[source] = (degree[source] ?? 0) + 1;
    degree[target] = (degree[target] ?? 0) + 1;
  }

  // Build nodes
  const nodes: GraphNode[] = [];
  for (const rawNode of rawNodes) {
    if (!rawNode || typeof rawNode !== "object") continue;

    const node = rawNode as Record<string, unknown>;
    if (!("id" in node)) continue;

    const id = String(node.id);
    const label = String(node.label || node.id);
    const community = node.community ?? null;
    const type = String(node.file_type || "other");
    const nodeD = degree[id] ?? 0;
    const betweenness =
      "betweenness" in node ? (typeof node.betweenness === "number" ? node.betweenness : null) : null;

    nodes.push({ id, label, community, type, degree: nodeD, betweenness });
  }

  // Sort by degree descending, then by id ascending
  nodes.sort((a, b) => {
    if (a.degree !== b.degree) {
      return b.degree - a.degree;
    }
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  const node_count = nodes.length;
  const link_count = rawLinks.length;
  const truncated = node_count > limit;
  const keptNodeIds = new Set(nodes.slice(0, limit).map((n) => n.id));

  // Filter links to only include those with both endpoints in kept nodes
  const links: GraphLink[] = [];
  for (const rawLink of rawLinks) {
    if (!rawLink || typeof rawLink !== "object") continue;
    const link = rawLink as Record<string, unknown>;
    const source = endpoint(link.source);
    const target = endpoint(link.target);

    if (keptNodeIds.has(source) && keptNodeIds.has(target)) {
      links.push({ source, target });
    }
  }

  return {
    present: true,
    node_count,
    link_count,
    truncated,
    nodes: nodes.slice(0, limit),
    links,
  };
}
