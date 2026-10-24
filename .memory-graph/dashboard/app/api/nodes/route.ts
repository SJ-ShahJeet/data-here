import fs from "fs";
import path from "path";
import { memoryDir } from "@/lib/mg-config";
import { repoRoot } from "@/lib/repo-root";
import { nodes as scanNodes } from "@/lib/scan";
import type { NodeAction } from "@/lib/v2/types";

const NODE_ACTIONS: readonly NodeAction[] = ["confirm", "reject", "pin", "prune", "merge"];

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The only thing outside the engine that writes memory/nodes.json. Every
// action is validated in full before the file is touched: a bad id or action
// leaves the store byte-for-byte unchanged.

type RawNode = Record<string, unknown> & { id: string };
type RawStore = Record<string, unknown> & { nodes: RawNode[] };

function bad(error: string, status = 400): Response {
  return Response.json({ ok: false, error }, { status });
}

function isRawNode(v: unknown): v is RawNode {
  return !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as RawNode).id === "string";
}

/** Reads the store, or explains why it can't be written through. */
function readStore(storePath: string): { store: RawStore } | { error: Response } {
  let text: string;
  try {
    text = fs.readFileSync(storePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { error: bad("no node store yet — nodes appear after the first session with open items") };
    }
    return { error: bad("node store unreadable", 500) };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // The engine quarantines a corrupt store on its next run; the dashboard
    // must not paper over it with a fresh file.
    return { error: bad("node store is not valid JSON") };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: bad("node store has an unexpected shape") };
  }
  const rec = parsed as Record<string, unknown>;
  if (!Array.isArray(rec.nodes) || !rec.nodes.every(isRawNode)) {
    return { error: bad("node store has an unexpected shape") };
  }
  return { store: rec as RawStore };
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Applies the action in place. `targets` are in request order, which only
 * matters for merge: among equal weights the first listed survives.
 */
function apply(action: NodeAction, targets: RawNode[]): void {
  switch (action) {
    case "confirm":
      for (const n of targets) {
        n.status = "confirmed";
        n.base_weight = n.weight;
      }
      return;
    case "reject":
      for (const n of targets) n.status = "rejected";
      return;
    case "pin":
      for (const n of targets) {
        n.status = "pinned";
        n.weight = 1;
        n.base_weight = 1;
      }
      return;
    case "prune":
      for (const n of targets) n.status = "pruned";
      return;
    case "merge": {
      // Stable sort keeps ties in request order, so the earliest-listed of
      // equal-weight nodes survives. The survivor is left untouched — only
      // the folded nodes' status and merged_into change.
      const ranked = targets.slice().sort((a, b) => num(b.weight, 0) - num(a.weight, 0));
      const keep = ranked[0];
      for (const n of ranked.slice(1)) {
        n.status = "merged_into";
        n.merged_into = keep.id;
      }
      return;
    }
  }
}

/** Recursively sorts object keys — the engine dumps with sort_keys=True. */
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) out[k] = sortKeys((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

function writeStore(storePath: string, store: RawStore): void {
  const dir = path.dirname(storePath);
  const tmp = path.join(dir, `.nodes-${process.pid}-${Date.now()}.json.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(sortKeys(store), null, 2) + "\n", "utf-8");
    fs.renameSync(tmp, storePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // nothing to clean up
    }
    throw err;
  }
}

/**
 * A cross-site page could POST here without a preflight (the body is read
 * regardless of Content-Type), so a request that carries an Origin must come
 * from the host serving the dashboard.
 */
function crossSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (crossSite(request)) return bad("cross-site request refused", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("invalid request body");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return bad("body must be an object");
  }

  const { ids, action } = body as Record<string, unknown>;
  if (typeof action !== "string" || !(NODE_ACTIONS as readonly string[]).includes(action)) {
    return bad(`unknown action: ${String(action)}`);
  }
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string" && id.length > 0)) {
    return bad("ids must be a non-empty array of strings");
  }
  const unique = Array.from(new Set(ids as string[]));
  if (action === "merge" && unique.length < 2) {
    return bad("merge needs two or more ids");
  }

  const storePath = path.join(memoryDir(repoRoot()), "nodes.json");
  const read = readStore(storePath);
  if ("error" in read) return read.error;
  const { store } = read;

  // Every node carrying a listed id is a target, so a store with a duplicated
  // id (should not happen, but the file is hand-editable) is changed
  // consistently rather than half-way.
  const present = new Set(store.nodes.map((n) => n.id));
  const missing = unique.find((id) => !present.has(id));
  if (missing !== undefined) return bad(`unknown id: ${missing}`);

  const targets = unique.flatMap((id) => store.nodes.filter((n) => n.id === id));
  // A node already folded into another is not a live node; acting on it would
  // either revive a ghost or, for merge, create a merged_into cycle.
  const folded = targets.find((n) => n.status === "merged_into");
  if (folded) return bad(`node ${folded.id} is merged into ${String(folded.merged_into ?? "another node")}`);

  apply(action as NodeAction, targets);

  try {
    writeStore(storePath, store);
  } catch {
    return bad("could not write node store", 500);
  }

  // Re-scan through the same reader the rest of the app uses, so the
  // response reflects exactly what a fresh page load would show.
  return Response.json({ ok: true, nodes: scanNodes(repoRoot()).nodes }, { headers: { "Cache-Control": "no-store" } });
}
