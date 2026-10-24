import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { POST } from "@/app/api/nodes/route";
import { nodes as scanNodes, type MemoryNode } from "@/lib/scan/nodes";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

type StoredNode = MemoryNode;

function mkNode(overrides: Partial<StoredNode> = {}): StoredNode {
  return {
    id: "n1",
    claim: "a claim",
    kind: "Decision",
    status: "unreviewed",
    weight: 0.5,
    base_weight: 0.4,
    first_seen: "2026-08-01",
    last_seen: "2026-08-07",
    seen_count: 3,
    source_session: "sessions/2026-08-07-1.md",
    ...overrides,
  };
}

function writeStore(sandbox: Sandbox, nodesArr: StoredNode[], ingestedSessions: string[] = []) {
  sandbox.write(
    "memory/nodes.json",
    JSON.stringify({ nodes: nodesArr, ingested_sessions: ingestedSessions })
  );
}

function post(body: unknown): Promise<Response> {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return POST(
    new Request("http://localhost/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    })
  );
}

function memoryFiles(sandbox: Sandbox): string[] {
  const dir = path.join(sandbox.root, "memory");
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

describe("POST /api/nodes", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
    delete process.env.REPO_ROOT;
  });

  describe("scenario 1: confirm", () => {
    it("sets status to confirmed and locks base_weight to the node's current weight", async () => {
      writeStore(sandbox, [mkNode({ id: "a", status: "unreviewed", weight: 0.73, base_weight: 0.4 })]);
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: ["a"], action: "confirm" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      const a = body.nodes.find((n: StoredNode) => n.id === "a");
      expect(a.status).toBe("confirmed");
      expect(a.weight).toBe(0.73);
      expect(a.base_weight).toBe(0.73);
    });
  });

  describe("scenario 2: pin", () => {
    it("sets status to pinned and forces both weight and base_weight to 1", async () => {
      writeStore(sandbox, [mkNode({ id: "a", status: "unreviewed", weight: 0.2, base_weight: 0.1 })]);
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: ["a"], action: "pin" });
      const body = await res.json();

      expect(res.status).toBe(200);
      const a = body.nodes.find((n: StoredNode) => n.id === "a");
      expect(a.status).toBe("pinned");
      expect(a.weight).toBe(1);
      expect(a.base_weight).toBe(1);
    });
  });

  describe("scenario 3: reject", () => {
    it("sets status to rejected and leaves weight and base_weight untouched", async () => {
      writeStore(sandbox, [mkNode({ id: "a", status: "unreviewed", weight: 0.55, base_weight: 0.4 })]);
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: ["a"], action: "reject" });
      const body = await res.json();

      expect(res.status).toBe(200);
      const a = body.nodes.find((n: StoredNode) => n.id === "a");
      expect(a.status).toBe("rejected");
      expect(a.weight).toBe(0.55);
      expect(a.base_weight).toBe(0.4);
    });
  });

  describe("scenario 4: prune", () => {
    it("sets status to pruned and leaves weight and base_weight untouched", async () => {
      writeStore(sandbox, [mkNode({ id: "a", status: "confirmed", weight: 0.1, base_weight: 0.1 })]);
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: ["a"], action: "prune" });
      const body = await res.json();

      expect(res.status).toBe(200);
      const a = body.nodes.find((n: StoredNode) => n.id === "a");
      expect(a.status).toBe("pruned");
      expect(a.weight).toBe(0.1);
      expect(a.base_weight).toBe(0.1);
    });
  });

  describe("scenario 5: merge", () => {
    it("keeps the heaviest node's status, marks the others merged_into it in the stored file, and preserves nodes not listed", async () => {
      writeStore(sandbox, [
        mkNode({ id: "light", status: "unreviewed", weight: 0.2 }),
        mkNode({ id: "heavy", status: "confirmed", weight: 0.8 }),
        mkNode({ id: "untouched", status: "confirmed", weight: 0.9 }),
      ]);
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: ["light", "heavy"], action: "merge" });
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);

      const raw = JSON.parse(sandbox.read("memory/nodes.json")).nodes;
      const heavy = raw.find((n: any) => n.id === "heavy");
      const light = raw.find((n: any) => n.id === "light");
      const untouched = raw.find((n: any) => n.id === "untouched");

      expect(heavy.status).toBe("confirmed");
      expect(heavy.merged_into).toBeUndefined();
      expect(light.status).toBe("merged_into");
      expect(light.merged_into).toBe("heavy");
      expect(untouched.status).toBe("confirmed");
      expect(untouched.merged_into).toBeUndefined();

      // The response's node list has the same shape lib/scan/nodes.ts's
      // nodes(root) returns, reflecting the write just made.
      expect(body.nodes).toEqual(scanNodes(sandbox.root).nodes);
    });

    it("breaks a weight tie in favour of the first tied id in request order", async () => {
      writeStore(sandbox, [
        mkNode({ id: "a", status: "unreviewed", weight: 0.3 }),
        mkNode({ id: "b", status: "confirmed", weight: 0.9 }),
        mkNode({ id: "c", status: "pinned", weight: 0.9 }),
      ]);
      process.env.REPO_ROOT = sandbox.root;

      // "c" appears before "b" among the tied (0.9-weight) ids, so it keeps.
      const res = await post({ ids: ["a", "c", "b"], action: "merge" });
      expect(res.status).toBe(200);

      const raw = JSON.parse(sandbox.read("memory/nodes.json")).nodes;
      const a = raw.find((n: any) => n.id === "a");
      const b = raw.find((n: any) => n.id === "b");
      const c = raw.find((n: any) => n.id === "c");

      expect(c.status).toBe("pinned");
      expect(c.merged_into).toBeUndefined();
      expect(a.status).toBe("merged_into");
      expect(a.merged_into).toBe("c");
      expect(b.status).toBe("merged_into");
      expect(b.merged_into).toBe("c");
    });
  });

  describe("scenario 6: merge with fewer than 2 distinct ids", () => {
    it("rejects a single id with 400 and leaves the file unchanged", async () => {
      writeStore(sandbox, [mkNode({ id: "a" })]);
      process.env.REPO_ROOT = sandbox.root;
      const before = sandbox.read("memory/nodes.json");

      const res = await post({ ids: ["a"], action: "merge" });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(typeof body.error).toBe("string");
      expect(sandbox.read("memory/nodes.json")).toBe(before);
    });

    it("rejects ids that dedupe to fewer than 2 distinct entries with 400", async () => {
      writeStore(sandbox, [mkNode({ id: "a" }), mkNode({ id: "b" })]);
      process.env.REPO_ROOT = sandbox.root;
      const before = sandbox.read("memory/nodes.json");

      const res = await post({ ids: ["a", "a"], action: "merge" });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(sandbox.read("memory/nodes.json")).toBe(before);
    });
  });

  describe("scenario 7: unknown id", () => {
    it("rejects an id that is not in the store with 400 and leaves the file unchanged", async () => {
      writeStore(sandbox, [mkNode({ id: "a" })]);
      process.env.REPO_ROOT = sandbox.root;
      const before = sandbox.read("memory/nodes.json");

      const res = await post({ ids: ["ghost"], action: "confirm" });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(sandbox.read("memory/nodes.json")).toBe(before);
    });
  });

  describe("scenario 8: unknown action / malformed ids", () => {
    it("rejects an unrecognized action with 400", async () => {
      writeStore(sandbox, [mkNode({ id: "a" })]);
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: ["a"], action: "delete" });
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
    });

    it("rejects a request where ids is not an array with 400", async () => {
      writeStore(sandbox, [mkNode({ id: "a" })]);
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: "a", action: "confirm" });
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
    });

    it("rejects an empty ids array with 400", async () => {
      writeStore(sandbox, [mkNode({ id: "a" })]);
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: [], action: "confirm" });
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
    });

    it("rejects ids containing a non-string entry with 400", async () => {
      writeStore(sandbox, [mkNode({ id: "a" })]);
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: ["a", 123], action: "confirm" });
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
    });

    it("rejects a request missing the ids field with 400", async () => {
      writeStore(sandbox, [mkNode({ id: "a" })]);
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ action: "confirm" });
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
    });
  });

  describe("scenario 9: invalid JSON body", () => {
    it("rejects a malformed JSON body with 400 and leaves the file unchanged", async () => {
      writeStore(sandbox, [mkNode({ id: "a" })]);
      process.env.REPO_ROOT = sandbox.root;
      const before = sandbox.read("memory/nodes.json");

      const res = await post("{not valid json");
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(sandbox.read("memory/nodes.json")).toBe(before);
    });
  });

  describe("scenario 10: missing store", () => {
    it("returns 400 when memory/nodes.json does not exist", async () => {
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: ["a"], action: "confirm" });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
    });
  });

  describe("scenario 11: corrupt store", () => {
    it("returns 400 when memory/nodes.json is not valid JSON and leaves the file unchanged", async () => {
      sandbox.write("memory/nodes.json", "{not valid json at all");
      process.env.REPO_ROOT = sandbox.root;
      const before = sandbox.read("memory/nodes.json");

      const res = await post({ ids: ["a"], action: "confirm" });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(sandbox.read("memory/nodes.json")).toBe(before);
    });
  });

  describe("scenario 12: duplicate ids are deduplicated", () => {
    it("confirming the same id twice in one request confirms it once and returns 200", async () => {
      writeStore(sandbox, [mkNode({ id: "a", status: "unreviewed", weight: 0.6, base_weight: 0.3 })]);
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: ["a", "a"], action: "confirm" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      const matches = body.nodes.filter((n: StoredNode) => n.id === "a");
      expect(matches).toHaveLength(1);
      expect(matches[0].status).toBe("confirmed");
      expect(matches[0].base_weight).toBe(0.6);
    });
  });

  describe("scenario 13: response reflects the write; other nodes and ingested_sessions untouched", () => {
    it("returns nodes matching lib/scan/nodes.ts's nodes(root) after the write, and preserves the untouched node and ingested_sessions exactly", async () => {
      const untouched = mkNode({
        id: "b",
        claim: "untouched claim",
        status: "confirmed",
        weight: 0.77,
        base_weight: 0.6,
      });
      writeStore(
        sandbox,
        [mkNode({ id: "a", status: "unreviewed", weight: 0.5, base_weight: 0.4 }), untouched],
        ["sessions/2026-08-07-1.md", "sessions/2026-08-06-1.md"]
      );
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: ["a"], action: "confirm" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.nodes).toEqual(scanNodes(sandbox.root).nodes);

      const raw = JSON.parse(sandbox.read("memory/nodes.json"));
      expect(raw.ingested_sessions).toEqual([
        "sessions/2026-08-07-1.md",
        "sessions/2026-08-06-1.md",
      ]);
      const rawB = raw.nodes.find((n: StoredNode) => n.id === "b");
      expect(rawB).toEqual(untouched);
    });
  });

  describe("scenario 14: atomic write", () => {
    it("does not leave any .tmp files in memory/ after a successful write", async () => {
      writeStore(sandbox, [mkNode({ id: "a" })]);
      process.env.REPO_ROOT = sandbox.root;

      const res = await post({ ids: ["a"], action: "confirm" });
      expect(res.status).toBe(200);

      const leftover = memoryFiles(sandbox).filter((f) => f.endsWith(".tmp"));
      expect(leftover).toEqual([]);
    });
  });
});

describe("POST /api/nodes — review regressions", () => {
  let sandbox: Sandbox;
  beforeEach(() => {
    sandbox = makeSandbox();
    process.env.REPO_ROOT = sandbox.root;
  });
  afterEach(() => {
    sandbox.cleanup();
    delete process.env.REPO_ROOT;
  });

  it("refuses to act on a node that is already merged into another (no ghosts, no cycles)", async () => {
    writeStore(sandbox, [
      mkNode({ id: "a", weight: 0.9 }),
      mkNode({ id: "b", weight: 0.5, status: "merged_into", merged_into: "a" } as Partial<StoredNode>),
    ]);
    const before = fs.readFileSync(path.join(sandbox.root, "memory", "nodes.json"), "utf-8");
    for (const action of ["confirm", "pin", "merge"]) {
      const res = await post({ ids: ["b", "a"], action });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/merged into/);
    }
    expect(fs.readFileSync(path.join(sandbox.root, "memory", "nodes.json"), "utf-8")).toBe(before);
  });

  it("changes every stored node that carries a duplicated id", async () => {
    writeStore(sandbox, [mkNode({ id: "dup", weight: 0.4 }), mkNode({ id: "dup", weight: 0.6 })]);
    const res = await post({ ids: ["dup"], action: "reject" });
    expect(res.status).toBe(200);
    const stored = JSON.parse(fs.readFileSync(path.join(sandbox.root, "memory", "nodes.json"), "utf-8"));
    expect(stored.nodes.map((n: StoredNode) => n.status)).toEqual(["rejected", "rejected"]);
  });

  it("refuses a cross-site request that carries a foreign Origin", async () => {
    writeStore(sandbox, [mkNode({ id: "a" })]);
    const res = await POST(
      new Request("http://localhost:3000/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json", host: "localhost:3000", origin: "https://evil.example" },
        body: JSON.stringify({ ids: ["a"], action: "confirm" }),
      }),
    );
    expect(res.status).toBe(403);
    const stored = JSON.parse(fs.readFileSync(path.join(sandbox.root, "memory", "nodes.json"), "utf-8"));
    expect(stored.nodes[0].status).not.toBe("confirmed");
  });

  it("accepts a same-origin request", async () => {
    writeStore(sandbox, [mkNode({ id: "a" })]);
    const res = await POST(
      new Request("http://localhost:3000/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json", host: "localhost:3000", origin: "http://localhost:3000" },
        body: JSON.stringify({ ids: ["a"], action: "confirm" }),
      }),
    );
    expect(res.status).toBe(200);
  });
});
