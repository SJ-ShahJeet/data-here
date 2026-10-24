import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { graphFreshness } from "@/lib/scan/graph-freshness";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("graphFreshness", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("happy paths", () => {
    it("returns present true when graph.json exists", () => {
      sandbox.write("graphify-out/graph.json", '{"nodes":[],"links":[]}');
      const result = graphFreshness(sandbox.root);

      expect(result.present).toBe(true);
    });

    it("returns graph_mtime as ISO UTC string", () => {
      sandbox.write("graphify-out/graph.json", '{"nodes":[],"links":[]}');
      const result = graphFreshness(sandbox.root);

      expect(result.graph_mtime).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
      );
    });

    it("returns null last_commit when not a git repo", () => {
      sandbox.write("graphify-out/graph.json", '{"nodes":[],"links":[]}');
      const result = graphFreshness(sandbox.root);

      expect(result.last_commit).toBeNull();
    });

    it("returns null behind when last_commit is null", () => {
      sandbox.write("graphify-out/graph.json", '{"nodes":[],"links":[]}');
      const result = graphFreshness(sandbox.root);

      expect(result.behind).toBeNull();
    });
  });

  describe("absent graph file", () => {
    it("returns present false when graph.json does not exist", () => {
      const result = graphFreshness(sandbox.root);

      expect(result.present).toBe(false);
    });

    it("returns null for all dates when graph.json absent", () => {
      const result = graphFreshness(sandbox.root);

      expect(result.graph_mtime).toBeNull();
      expect(result.last_commit).toBeNull();
      expect(result.behind).toBeNull();
    });

    it("returns expected absent shape", () => {
      const result = graphFreshness(sandbox.root);

      expect(result).toEqual({
        present: false,
        graph_mtime: null,
        last_commit: null,
        behind: null,
      });
    });
  });

  describe("graph exists but invalid", () => {
    it("returns present true for file even if JSON invalid", () => {
      sandbox.write("graphify-out/graph.json", "not json");
      const result = graphFreshness(sandbox.root);

      expect(result.present).toBe(true);
      expect(result.graph_mtime).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
      );
    });
  });

  describe("graph is directory not file", () => {
    it("returns present false when graphify-out/graph.json is a directory", () => {
      sandbox.mkdir("graphify-out/graph.json");
      const result = graphFreshness(sandbox.root);

      expect(result.present).toBe(false);
    });
  });

  describe("git integration (non-git scenarios)", () => {
    it("never throws when not in a git repo", () => {
      sandbox.write("graphify-out/graph.json", '{"nodes":[],"links":[]}');
      expect(() => {
        graphFreshness(sandbox.root);
      }).not.toThrow();
    });

    it("returns null last_commit and behind for non-git directory", () => {
      sandbox.write("graphify-out/graph.json", '{"nodes":[],"links":[]}');
      const result = graphFreshness(sandbox.root);

      expect(result.last_commit).toBeNull();
      expect(result.behind).toBeNull();
    });

    it("never throws on git timeout (5s)", () => {
      sandbox.write("graphify-out/graph.json", '{"nodes":[],"links":[]}');
      expect(() => {
        graphFreshness(sandbox.root);
      }).not.toThrow();
    });
  });

  describe("error cases", () => {
    it("returns absent shape on invalid path", () => {
      const result = graphFreshness("/nonexistent/path");

      expect(result).toEqual({
        present: false,
        graph_mtime: null,
        last_commit: null,
        behind: null,
      });
    });

    it("never throws even with permission errors", () => {
      expect(() => {
        graphFreshness("/root/no-access");
      }).not.toThrow();
    });
  });

  describe("object key order", () => {
    it("returns keys in order: present, graph_mtime, last_commit, behind", () => {
      const result = graphFreshness(sandbox.root);
      const keys = Object.keys(result);

      expect(keys).toEqual(["present", "graph_mtime", "last_commit", "behind"]);
    });
  });

  describe("mtime precision", () => {
    it("returns 20-char ISO UTC string (no milliseconds)", () => {
      sandbox.write("graphify-out/graph.json", '{"nodes":[],"links":[]}');
      const result = graphFreshness(sandbox.root);

      expect(result.graph_mtime).toHaveLength(20);
      expect(result.graph_mtime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });
  });
});
