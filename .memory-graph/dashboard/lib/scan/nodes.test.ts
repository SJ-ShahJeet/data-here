import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { nodes } from "@/lib/scan/nodes";
import { collect, nodes as nodesFromBarrel } from "@/lib/scan";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("nodes", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("missing store (scenario 1)", () => {
    it("returns present false, empty nodes and empty injected when nothing exists", () => {
      const result = nodes(sandbox.root);

      expect(result).toEqual({ present: false, count: 0, nodes: [], injected: [], injected_at: "" });
    });

    it("still reads the injected file even though nodes.json is missing", () => {
      sandbox.write(
        "memory/.brief-injected.json",
        JSON.stringify({ updated: "2026-08-07T10:00:00Z", ids: ["n1"] })
      );

      const result = nodes(sandbox.root);

      expect(result.present).toBe(false);
      expect(result.count).toBe(0);
      expect(result.nodes).toEqual([]);
      expect(result.injected).toEqual(["n1"]);
    });
  });

  describe("valid store (scenario 2)", () => {
    it("parses a 2-node store with numeric fields as numbers and reads the injected ids", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({
          nodes: [
            {
              id: "n1",
              claim: "claim one",
              kind: "Decision",
              status: "confirmed",
              weight: 0.8,
              base_weight: 0.75,
              first_seen: "2026-01-01T00:00:00Z",
              last_seen: "2026-01-02T00:00:00Z",
              seen_count: 3,
              source_session: "sessions/2026-08-07-1.md",
            },
            {
              id: "n2",
              claim: "claim two",
              kind: "Constraint",
              status: "unreviewed",
              weight: 0.5,
              base_weight: 0.5,
              first_seen: "2026-01-03T00:00:00Z",
              last_seen: "2026-01-04T00:00:00Z",
              seen_count: 1,
              source_session: "sessions/2026-08-06-1.md",
            },
          ],
          ingested_sessions: ["sessions/2026-08-07-1.md"],
        })
      );
      sandbox.write(
        "memory/.brief-injected.json",
        JSON.stringify({ updated: "2026-08-07T10:00:00Z", ids: ["n1"] })
      );

      const result = nodes(sandbox.root);

      expect(result.present).toBe(true);
      expect(result.count).toBe(2);
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0]).toEqual({
        id: "n1",
        claim: "claim one",
        kind: "Decision",
        status: "confirmed",
        weight: 0.8,
        base_weight: 0.75,
        first_seen: "2026-01-01T00:00:00Z",
        last_seen: "2026-01-02T00:00:00Z",
        seen_count: 3,
        source_session: "sessions/2026-08-07-1.md",
      });
      expect(typeof result.nodes[0].weight).toBe("number");
      expect(typeof result.nodes[0].seen_count).toBe("number");
      expect(result.injected).toEqual(["n1"]);
    });

    it("filters non-string ids out of the injected list", () => {
      sandbox.write("memory/nodes.json", JSON.stringify({ nodes: [] }));
      sandbox.write(
        "memory/.brief-injected.json",
        JSON.stringify({ updated: "x", ids: ["n1", 5, null, "n2"] })
      );

      const result = nodes(sandbox.root);

      expect(result.injected).toEqual(["n1", "n2"]);
    });
  });

  describe("corrupt store (scenario 3)", () => {
    it("returns present false and empty nodes when nodes.json is not valid JSON", () => {
      sandbox.write("memory/nodes.json", "{not json");

      const result = nodes(sandbox.root);

      expect(result.present).toBe(false);
      expect(result.nodes).toEqual([]);
    });

    it("returns present false when the nodes field is not an array", () => {
      sandbox.write("memory/nodes.json", JSON.stringify({ nodes: 5 }));

      const result = nodes(sandbox.root);

      expect(result.present).toBe(false);
      expect(result.nodes).toEqual([]);
    });
  });

  describe("malformed entries (scenario 4)", () => {
    it("skips non-object entries and entries missing a string id or claim", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({
          nodes: [
            "not an object",
            null,
            42,
            { claim: "no id" },
            { id: "no-claim" },
            { id: 5, claim: "id not a string" },
            { id: "claim-not-string", claim: 5 },
            { id: "n1", claim: "claim one" },
            { id: "n2", claim: "claim two", weight: 0.5 },
          ],
        })
      );

      const result = nodes(sandbox.root);

      expect(result.count).toBe(2);
      expect(result.nodes.map((n) => n.id)).toEqual(["n1", "n2"]);
    });

    it("defaults weight to 0, base_weight to weight, and seen_count to 1 when all are missing", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({ nodes: [{ id: "n1", claim: "claim one" }] })
      );

      const result = nodes(sandbox.root);

      expect(result.nodes[0].weight).toBe(0);
      expect(result.nodes[0].base_weight).toBe(0);
      expect(result.nodes[0].seen_count).toBe(1);
    });

    it("defaults base_weight to the provided weight when base_weight alone is missing", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({ nodes: [{ id: "n1", claim: "claim one", weight: 0.42 }] })
      );

      const result = nodes(sandbox.root);

      expect(result.nodes[0].weight).toBe(0.42);
      expect(result.nodes[0].base_weight).toBe(0.42);
    });

    it("defaults missing string fields to an empty string", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({ nodes: [{ id: "n1", claim: "claim one" }] })
      );

      const result = nodes(sandbox.root);

      expect(result.nodes[0].kind).toBe("");
      expect(result.nodes[0].status).toBe("");
      expect(result.nodes[0].first_seen).toBe("");
      expect(result.nodes[0].last_seen).toBe("");
      expect(result.nodes[0].source_session).toBe("");
    });
  });

  describe("corrupt injected file (scenario 5)", () => {
    it("returns an empty injected array when the injected file is not valid JSON, while nodes still parse", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({ nodes: [{ id: "n1", claim: "claim one", weight: 0.5 }] })
      );
      sandbox.write("memory/.brief-injected.json", "{not json");

      const result = nodes(sandbox.root);

      expect(result.present).toBe(true);
      expect(result.nodes).toHaveLength(1);
      expect(result.injected).toEqual([]);
    });

    it("returns an empty injected array when the ids field is not an array", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({ nodes: [{ id: "n1", claim: "claim one" }] })
      );
      sandbox.write(
        "memory/.brief-injected.json",
        JSON.stringify({ updated: "x", ids: "not-an-array" })
      );

      const result = nodes(sandbox.root);

      expect(result.present).toBe(true);
      expect(result.injected).toEqual([]);
    });
  });

  describe("collect() integration (scenario 6)", () => {
    it("collect(root) includes a nodes field with the same shape nodes() returns", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({
          nodes: [
            {
              id: "n1",
              claim: "claim one",
              kind: "Decision",
              status: "confirmed",
              weight: 0.8,
              base_weight: 0.75,
              first_seen: "2026-01-01T00:00:00Z",
              last_seen: "2026-01-02T00:00:00Z",
              seen_count: 3,
              source_session: "sessions/2026-08-07-1.md",
            },
          ],
        })
      );
      sandbox.write(
        "memory/.brief-injected.json",
        JSON.stringify({ updated: "x", ids: ["n1"] })
      );

      const direct = nodes(sandbox.root);
      const state = collect(sandbox.root);

      expect(state.nodes).toEqual(direct);
      expect(state.nodes.present).toBe(true);
      expect(state.nodes.count).toBe(1);
      expect(state.nodes.injected).toEqual(["n1"]);
    });

    it("re-exports nodes from the @/lib/scan barrel", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({ nodes: [{ id: "n1", claim: "claim one" }] })
      );

      expect(nodesFromBarrel(sandbox.root)).toEqual(nodes(sandbox.root));
    });
  });
});
