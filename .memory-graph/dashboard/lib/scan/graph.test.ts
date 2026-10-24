import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { graph } from "@/lib/scan/graph";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("graph", () => {
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
      const result = graph(sandbox.root);

      expect(result.present).toBe(true);
    });

    it("parses nodes from graph.json", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a","label":"A"}],"links":[]}'
      );
      const result = graph(sandbox.root);

      expect(result.nodes.length).toBeGreaterThan(0);
    });

    it("parses links from graph.json", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a"},{"id":"b"}],"links":[{"source":"a","target":"b"}]}'
      );
      const result = graph(sandbox.root);

      expect(result.links.length).toBeGreaterThan(0);
    });

    it("skips nodes without id property", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a","label":"A"},{"nolabel":true}],"links":[]}'
      );
      const result = graph(sandbox.root);

      expect(result.node_count).toBe(1);
    });

    it("calculates degree for each node", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a"},{"id":"b"},{"id":"c"}],"links":[{"source":"a","target":"b"},{"source":"a","target":"c"}]}'
      );
      const result = graph(sandbox.root);

      const nodeA = result.nodes.find((n) => n.id === "a");
      expect(nodeA?.degree).toBe(2);
    });

    it("sorts nodes by degree descending then id ascending", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"c"},{"id":"b"},{"id":"a"}],"links":[{"source":"a","target":"b"},{"source":"a","target":"c"}]}'
      );
      const result = graph(sandbox.root);

      expect(result.nodes[0].id).toBe("a");
      expect(result.nodes[0].degree).toBe(2);
      expect(result.nodes[1].id).toBe("b");
      expect(result.nodes[2].id).toBe("c");
    });

    it("includes link_count as count of all raw links", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a"},{"id":"b"}],"links":[{"source":"a","target":"b"},{"source":"a","target":"b"}]}'
      );
      const result = graph(sandbox.root);

      expect(result.link_count).toBe(2);
    });

    it("filters links by kept node endpoints", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a"},{"id":"b"},{"id":"c"}],"links":[{"source":"a","target":"b"},{"source":"b","target":"c"}]}'
      );
      const result = graph(sandbox.root, 1);

      expect(result.links.length).toBe(0);
    });

    it("has correct key order", () => {
      sandbox.write("graphify-out/graph.json", '{"nodes":[],"links":[]}');
      const result = graph(sandbox.root);

      const keys = Object.keys(result);
      expect(keys).toEqual([
        "present",
        "node_count",
        "link_count",
        "truncated",
        "nodes",
        "links",
      ]);
    });
  });

  describe("absent file", () => {
    it("returns present false when graph.json missing", () => {
      const result = graph(sandbox.root);

      expect(result.present).toBe(false);
    });

    it("returns absent shape when missing", () => {
      const result = graph(sandbox.root);

      expect(result).toEqual({
        present: false,
        node_count: 0,
        link_count: 0,
        truncated: false,
        nodes: [],
        links: [],
      });
    });
  });

  describe("invalid JSON", () => {
    it("returns absent shape when JSON invalid", () => {
      sandbox.write("graphify-out/graph.json", "not json");
      const result = graph(sandbox.root);

      expect(result.present).toBe(false);
      expect(result.nodes).toEqual([]);
    });

    it("returns absent shape when JSON is array", () => {
      sandbox.write("graphify-out/graph.json", '[]');
      const result = graph(sandbox.root);

      expect(result.present).toBe(false);
    });

    it("returns absent shape when JSON is string", () => {
      sandbox.write("graphify-out/graph.json", '"string"');
      const result = graph(sandbox.root);

      expect(result.present).toBe(false);
    });

    it("returns absent shape when JSON is null", () => {
      sandbox.write("graphify-out/graph.json", 'null');
      const result = graph(sandbox.root);

      expect(result.present).toBe(false);
    });
  });

  describe("node parsing", () => {
    it("coerces id to string", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":123,"label":"A"}],"links":[]}'
      );
      const result = graph(sandbox.root);

      expect(result.nodes[0].id).toBe("123");
      expect(typeof result.nodes[0].id).toBe("string");
    });

    it("uses label or id as fallback", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a","label":"A"},{"id":"b"}],"links":[]}'
      );
      const result = graph(sandbox.root);

      expect(result.nodes[0].label).toBe("A");
      expect(result.nodes[1].label).toBe("b");
    });

    it("passes community as-is", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a","community":1}],"links":[]}'
      );
      const result = graph(sandbox.root);

      expect(result.nodes[0].community).toBe(1);
    });

    it("emits null for undefined community", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a"}],"links":[]}'
      );
      const result = graph(sandbox.root);

      expect(result.nodes[0].community).toBeNull();
    });

    it("coerces file_type to type field as string", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a","file_type":"py"}],"links":[]}'
      );
      const result = graph(sandbox.root);

      expect(result.nodes[0].type).toBe("py");
    });

    it("defaults type to other when missing", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a"}],"links":[]}'
      );
      const result = graph(sandbox.root);

      expect(result.nodes[0].type).toBe("other");
    });

    it("parses betweenness as number when present", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a","betweenness":0.5}],"links":[]}'
      );
      const result = graph(sandbox.root);

      expect(result.nodes[0].betweenness).toBe(0.5);
    });

    it("defaults betweenness to null when absent", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a"}],"links":[]}'
      );
      const result = graph(sandbox.root);

      expect(result.nodes[0].betweenness).toBeNull();
    });

    it("has correct node key order", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a","label":"A","community":1,"file_type":"py","degree":5,"betweenness":0.5}],"links":[]}'
      );
      const result = graph(sandbox.root);

      const keys = Object.keys(result.nodes[0]);
      expect(keys).toEqual([
        "id",
        "label",
        "community",
        "type",
        "degree",
        "betweenness",
      ]);
    });
  });

  describe("limit and truncation", () => {
    it("defaults limit to 200", () => {
      const nodes = Array.from({ length: 250 }, (_, i) => ({
        id: `node${i}`,
      }));
      sandbox.write(
        "graphify-out/graph.json",
        JSON.stringify({
          nodes,
          links: [],
        })
      );
      const result = graph(sandbox.root);

      expect(result.node_count).toBe(250);
      expect(result.nodes.length).toBe(200);
      expect(result.truncated).toBe(true);
    });

    it("respects custom limit", () => {
      const nodes = Array.from({ length: 50 }, (_, i) => ({
        id: `node${i}`,
      }));
      sandbox.write(
        "graphify-out/graph.json",
        JSON.stringify({
          nodes,
          links: [],
        })
      );
      const result = graph(sandbox.root, 10);

      expect(result.nodes.length).toBe(10);
      expect(result.truncated).toBe(true);
    });

    it("returns truncated false when nodes <= limit", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a"},{"id":"b"}],"links":[]}'
      );
      const result = graph(sandbox.root, 200);

      expect(result.truncated).toBe(false);
    });
  });

  describe("link parsing", () => {
    it("extracts source and target as strings", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a"},{"id":"b"}],"links":[{"source":"a","target":"b"}]}'
      );
      const result = graph(sandbox.root);

      expect(result.links[0]).toEqual({
        source: "a",
        target: "b",
      });
    });

    it("handles object source/target with id property", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a"},{"id":"c"}],"links":[{"source":{"id":"a"},"target":{"id":"c"}}]}'
      );
      const result = graph(sandbox.root);

      expect(result.links[0]).toEqual({
        source: "a",
        target: "c",
      });
    });

    it("preserves file order of links", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a"},{"id":"b"},{"id":"c"}],"links":[{"source":"a","target":"b"},{"source":"a","target":"c"}]}'
      );
      const result = graph(sandbox.root);

      expect(result.links[0].target).toBe("b");
      expect(result.links[1].target).toBe("c");
    });

    it("filters links with missing endpoints", () => {
      sandbox.write(
        "graphify-out/graph.json",
        '{"nodes":[{"id":"a"}],"links":[{"source":"a","target":"missing"}]}'
      );
      const result = graph(sandbox.root);

      expect(result.links).toEqual([]);
    });
  });

  describe("fixture: graph.json", () => {
    it("matches contract fixture exactly", () => {
      sandbox.write(
        "graphify-out/graph.json",
        JSON.stringify({
          nodes: [
            { id: "a", label: "A", community: 1, file_type: "py", betweenness: 0.5 },
            { id: "b", file_type: "ts" },
            { id: "c", label: "C" },
            { nolabel: true },
          ],
          links: [
            { source: "a", target: "b" },
            { source: { id: "a" }, target: { id: "c" } },
          ],
        })
      );
      const result = graph(sandbox.root);

      expect(result.present).toBe(true);
      expect(result.node_count).toBe(3);
      expect(result.link_count).toBe(2);
      expect(result.truncated).toBe(false);

      expect(result.nodes.length).toBe(3);
      expect(result.nodes[0].id).toBe("a");
      expect(result.nodes[0].degree).toBe(2);
      expect(result.nodes[1].id).toBe("b");
      expect(result.nodes[2].id).toBe("c");

      expect(result.links).toEqual([
        { source: "a", target: "b" },
        { source: "a", target: "c" },
      ]);
    });

    it("truncation fixture", () => {
      sandbox.write(
        "graphify-out/graph.json",
        JSON.stringify({
          nodes: [
            { id: "a", label: "A", community: 1, file_type: "py", betweenness: 0.5 },
            { id: "b", file_type: "ts" },
            { id: "c", label: "C" },
          ],
          links: [
            { source: "a", target: "b" },
            { source: "a", target: "c" },
          ],
        })
      );
      const result = graph(sandbox.root, 1);

      expect(result.truncated).toBe(true);
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe("a");
      expect(result.links).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("handles empty nodes and links arrays", () => {
      sandbox.write("graphify-out/graph.json", '{"nodes":[],"links":[]}');
      const result = graph(sandbox.root);

      expect(result.present).toBe(true);
      expect(result.node_count).toBe(0);
      expect(result.link_count).toBe(0);
      expect(result.nodes).toEqual([]);
      expect(result.links).toEqual([]);
    });

    it("handles missing nodes property", () => {
      sandbox.write("graphify-out/graph.json", '{"links":[]}');
      const result = graph(sandbox.root);

      expect(result.nodes).toEqual([]);
    });

    it("handles missing links property", () => {
      sandbox.write("graphify-out/graph.json", '{"nodes":[{"id":"a"}]}');
      const result = graph(sandbox.root);

      expect(result.link_count).toBe(0);
      expect(result.links).toEqual([]);
    });

    it("never throws", () => {
      expect(() => {
        graph("/nonexistent/path");
      }).not.toThrow();
    });
  });
});
