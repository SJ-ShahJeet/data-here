import fs from "fs";
import path from "path";
import { memoryDir } from "@/lib/mg-config";

export interface MemoryNode {
  id: string;
  claim: string;
  kind: string;
  status: string;
  weight: number;
  base_weight: number;
  first_seen: string;
  last_seen: string;
  seen_count: number;
  source_session: string;
}

export interface Nodes {
  present: boolean;
  count: number;
  nodes: MemoryNode[];
  injected: string[];
  /** ISO time the brief that injected them was written; "" when unknown. */
  injected_at: string;
}

function readJson(filePath: string): unknown {
  const text = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(text);
}

/** Coerce a value to a finite number, falling back when it is not one. */
function finiteOr(val: unknown, fallback: number): number {
  return typeof val === "number" && Number.isFinite(val) ? val : fallback;
}

function stringOr(val: unknown, fallback: string): string {
  return typeof val === "string" ? val : fallback;
}

/** The ids the brief last injected into the model's context, and when. */
function readInjected(root: string): { injected: string[]; injected_at: string } {
  const injectedPath = path.join(memoryDir(root), ".brief-injected.json");
  const none = { injected: [], injected_at: "" };

  let parsed: unknown;
  try {
    parsed = readJson(injectedPath);
  } catch {
    return none;
  }

  if (!parsed || typeof parsed !== "object") return none;
  const rec = parsed as Record<string, unknown>;
  const ids = rec.ids;
  if (!Array.isArray(ids)) return none;
  return {
    injected: ids.filter((id): id is string => typeof id === "string"),
    injected_at: typeof rec.updated === "string" ? rec.updated : "",
  };
}

/** Reads the engine's node store, `memory/nodes.json`. */
export function nodes(root: string): Nodes {
  const { injected, injected_at } = readInjected(root);
  const storePath = path.join(memoryDir(root), "nodes.json");

  let parsed: unknown;
  try {
    parsed = readJson(storePath);
  } catch {
    return { present: false, count: 0, nodes: [], injected, injected_at };
  }

  if (!parsed || typeof parsed !== "object") {
    return { present: false, count: 0, nodes: [], injected, injected_at };
  }

  const rawNodes = (parsed as Record<string, unknown>).nodes;
  if (!Array.isArray(rawNodes)) {
    return { present: false, count: 0, nodes: [], injected, injected_at };
  }

  const kept: MemoryNode[] = [];
  for (const entry of rawNodes) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    if (typeof rec.id !== "string" || typeof rec.claim !== "string") continue;

    const weight = finiteOr(rec.weight, 0);
    kept.push({
      id: rec.id,
      claim: rec.claim,
      kind: stringOr(rec.kind, ""),
      status: stringOr(rec.status, ""),
      weight,
      base_weight: finiteOr(rec.base_weight, weight),
      first_seen: stringOr(rec.first_seen, ""),
      last_seen: stringOr(rec.last_seen, ""),
      seen_count: finiteOr(rec.seen_count, 1),
      source_session: stringOr(rec.source_session, ""),
    });
  }

  return { present: true, count: kept.length, nodes: kept, injected, injected_at };
}
