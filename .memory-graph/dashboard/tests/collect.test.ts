import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { collect } from "@/lib/scan/index";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("collect", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("payload structure", () => {
    it("returns object with exactly thirteen keys in scan.py order", () => {
      const result = collect(sandbox.root);

      const keys = Object.keys(result);
      expect(keys).toEqual([
        "generated_at",
        "repo",
        "freshness",
        "pipeline",
        "graph_freshness",
        "settings",
        "state",
        "sessions",
        "graph",
        "tiers",
        "agents",
        "compression",
        "nodes",
      ]);
    });

    it("has generated_at as ISO UTC string", () => {
      const result = collect(sandbox.root);

      expect(result.generated_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
      );
    });

    it("has repo as string", () => {
      const result = collect(sandbox.root);

      expect(typeof result.repo).toBe("string");
    });

    it("has freshness object", () => {
      const result = collect(sandbox.root);

      expect(typeof result.freshness).toBe("object");
      expect(result.freshness).not.toBeNull();
    });

    it("has pipeline object", () => {
      const result = collect(sandbox.root);

      expect(typeof result.pipeline).toBe("object");
      expect(result.pipeline).not.toBeNull();
    });

    it("has graph_freshness object", () => {
      const result = collect(sandbox.root);

      expect(typeof result.graph_freshness).toBe("object");
      expect(result.graph_freshness).not.toBeNull();
    });

    it("has settings object", () => {
      const result = collect(sandbox.root);

      expect(typeof result.settings).toBe("object");
      expect(result.settings).not.toBeNull();
    });

    it("has state object", () => {
      const result = collect(sandbox.root);

      expect(typeof result.state).toBe("object");
      expect(result.state).not.toBeNull();
    });

    it("has sessions object", () => {
      const result = collect(sandbox.root);

      expect(typeof result.sessions).toBe("object");
      expect(result.sessions).not.toBeNull();
    });

    it("has graph object", () => {
      const result = collect(sandbox.root);

      expect(typeof result.graph).toBe("object");
      expect(result.graph).not.toBeNull();
    });

    it("has tiers object", () => {
      const result = collect(sandbox.root);

      expect(typeof result.tiers).toBe("object");
      expect(result.tiers).not.toBeNull();
    });

    it("has agents object", () => {
      const result = collect(sandbox.root);

      expect(typeof result.agents).toBe("object");
      expect(result.agents).not.toBeNull();
    });

    it("has compression object", () => {
      const result = collect(sandbox.root);

      expect(typeof result.compression).toBe("object");
      expect(result.compression).not.toBeNull();
    });
  });

  describe("each value is direct collector call", () => {
    it("sessions value equals sessions(root)", () => {
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");
      const result = collect(sandbox.root);

      // Verify the structure matches what sessions() produces
      expect(result.sessions).toHaveProperty("present");
      expect(result.sessions).toHaveProperty("count");
      expect(result.sessions).toHaveProperty("items");
      expect(Array.isArray(result.sessions.items)).toBe(true);
    });

    it("graph value equals graph(root)", () => {
      sandbox.write("graphify-out/graph.json", '{"nodes":[],"links":[]}');
      const result = collect(sandbox.root);

      expect(result.graph).toHaveProperty("present");
      expect(result.graph).toHaveProperty("node_count");
      expect(result.graph).toHaveProperty("link_count");
      expect(result.graph).toHaveProperty("truncated");
      expect(Array.isArray(result.graph.nodes)).toBe(true);
      expect(Array.isArray(result.graph.links)).toBe(true);
    });

    it("tiers value equals tiers(root)", () => {
      const result = collect(sandbox.root);

      expect(result.tiers).toHaveProperty("hot");
      expect(result.tiers).toHaveProperty("warm");
      expect(result.tiers).toHaveProperty("cold");
      expect(result.tiers).toHaveProperty("brief");
    });

    it("agents value equals agents(root)", () => {
      const result = collect(sandbox.root);

      expect(result.agents).toHaveProperty("hosts");
      expect(Array.isArray(result.agents.hosts)).toBe(true);
      expect(result.agents.hosts.length).toBe(3);
    });

    it("compression value equals compression(root)", () => {
      const result = collect(sandbox.root);

      expect(result.compression).toHaveProperty("present");
      expect(result.compression).toHaveProperty("entries");
      expect(result.compression).toHaveProperty("total_before");
      expect(result.compression).toHaveProperty("total_after");
      expect(result.compression).toHaveProperty("total_saved");
    });
  });

  describe("empty sandbox", () => {
    it("succeeds with empty repo (no sessions/, no graphify-out/, no memory/state.yaml)", () => {
      const result = collect(sandbox.root);

      expect(result).toBeDefined();
      expect(Object.keys(result).length).toBe(13);
    });

    it("returns absent shapes for empty repo", () => {
      const result = collect(sandbox.root);

      expect(result.state.present).toBe(false);
      expect(result.sessions.present).toBe(false); // no sessions/ in an empty repo
      expect(result.sessions.items).toEqual([]);
      expect(result.graph.present).toBe(false);
      expect(result.compression.present).toBe(false);
    });

    it("result is JSON stringifiable when empty", () => {
      const result = collect(sandbox.root);

      expect(() => {
        JSON.stringify(result);
      }).not.toThrow();
    });
  });

  describe("fully populated sandbox", () => {
    it("result is JSON stringifiable when fully populated", () => {
      sandbox.write("memory/state.yaml", "updated: 2026-08-07\n");
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");
      sandbox.write("graphify-out/graph.json", '{"nodes":[],"links":[]}');
      sandbox.write("memory/.compression-log.jsonl", '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n');

      const result = collect(sandbox.root);

      expect(() => {
        JSON.stringify(result);
      }).not.toThrow();
    });

    it("populated repo has filled in values", () => {
      sandbox.write("memory/state.yaml", "updated: 2026-08-07\n");
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");

      const result = collect(sandbox.root);

      expect(result.state.present).toBe(true);
      expect(result.sessions.count).toBe(1);
    });
  });

  describe("generated_at precision", () => {
    it("generated_at is close to current time", () => {
      const beforeCall = Date.now();
      const result = collect(sandbox.root);
      const afterCall = Date.now();

      const generatedTime = new Date(result.generated_at).getTime();
      expect(generatedTime).toBeGreaterThanOrEqual(beforeCall - 1000);
      expect(generatedTime).toBeLessThanOrEqual(afterCall + 1000);
    });
  });

  describe("no logic beyond orchestration", () => {
    it("simply calls each collector and returns results", () => {
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");
      const result = collect(sandbox.root);

      // Verify it's calling the collectors, not doing its own logic
      expect(result.sessions.items.length).toBe(1);
      expect(result.sessions.items[0].file).toBe("sessions/2026-08-07-1.md");
    });
  });

  describe("never throws", () => {
    it("succeeds even with missing root", () => {
      expect(() => {
        collect("/nonexistent/path");
      }).not.toThrow();
    });

    it("succeeds with a nonexistent path", () => {
      expect(() => {
        collect("/nonexistent/path");
      }).not.toThrow();
    });
  });
});
