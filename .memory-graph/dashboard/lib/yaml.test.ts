import { describe, it, expect } from "vitest";
import { parseSimpleYaml, stripQuotes } from "@/lib/yaml";

describe("stripQuotes", () => {
  describe("happy paths", () => {
    it("removes surrounding double quotes", () => {
      expect(stripQuotes('"hello"')).toBe("hello");
    });

    it("removes surrounding single quotes", () => {
      expect(stripQuotes("'world'")).toBe("world");
    });

    it("preserves interior quotes", () => {
      expect(stripQuotes('"it\'s"')).toBe("it's");
      expect(stripQuotes("'say \"no\"'")).toBe('say "no"');
    });

    it("trims before checking quotes", () => {
      expect(stripQuotes('  "trimmed"  ')).toBe("trimmed");
      expect(stripQuotes("  'also trimmed'  ")).toBe("also trimmed");
    });

    it("does not remove mismatched quotes", () => {
      expect(stripQuotes('"single\'')).toBe('"single\'');
      expect(stripQuotes("'double\"")).toBe('\'double"');
    });

    it("does not remove if only one quote present", () => {
      expect(stripQuotes('"only start')).toBe('"only start');
      expect(stripQuotes('end only"')).toBe('end only"');
    });

    it("returns trimmed value when no quotes", () => {
      expect(stripQuotes("  plain text  ")).toBe("plain text");
    });

    it("handles empty string", () => {
      expect(stripQuotes("")).toBe("");
    });

    it("handles single quote char", () => {
      expect(stripQuotes('"')).toBe('"');
      expect(stripQuotes("'")).toBe("'");
    });

    it("handles empty quoted strings", () => {
      expect(stripQuotes('""')).toBe("");
      expect(stripQuotes("''")).toBe("");
    });
  });
});

describe("parseSimpleYaml", () => {
  describe("happy paths", () => {
    it("parses simple key-value pairs", () => {
      const yaml = `key: value\nfoo: bar`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({ key: "value", foo: "bar" });
    });

    it("trims keys and values", () => {
      const yaml = `key  :  value  `;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({ key: "value" });
    });

    it("ignores blank lines", () => {
      const yaml = `key: value\n\n\nfoo: bar`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({ key: "value", foo: "bar" });
    });

    it("ignores comment lines starting with #", () => {
      const yaml = `key: value\n# this is a comment\nfoo: bar`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({ key: "value", foo: "bar" });
    });

    it("ignores indented lines (they are only used as block items)", () => {
      const yaml = `key: value\n  indented: not parsed\nfoo: bar`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({ key: "value", foo: "bar" });
    });

    it("ignores lines without colons", () => {
      const yaml = `key: value\nno colon here\nfoo: bar`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({ key: "value", foo: "bar" });
    });

    it("parses block lists with dashes", () => {
      const yaml = `items:\n  - first\n  - second\nfoo: bar`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({
        items: ["first", "second"],
        foo: "bar",
      });
    });

    it("parses block lists with empty array marker", () => {
      const yaml = `items:\n  []\nfoo: bar`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({
        items: [],
        foo: "bar",
      });
    });

    it("handles block list items with quotes", () => {
      const yaml = `items:\n  - "quoted item"\n  - 'single quoted'\nfoo: bar`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({
        items: ["quoted item", "single quoted"],
        foo: "bar",
      });
    });

    it("stops block list at non-indented line", () => {
      const yaml = `items:\n  - first\n  - second\nfoo: bar`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({
        items: ["first", "second"],
        foo: "bar",
      });
    });

    it("parses JSON arrays", () => {
      const yaml = `items: ["a", "b", "c"]\nfoo: bar`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({
        items: ["a", "b", "c"],
        foo: "bar",
      });
    });

    it("parses quoted values", () => {
      const yaml = `key: "quoted value"\nfoo: 'single quoted'`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({
        key: "quoted value",
        foo: "single quoted",
      });
    });

    it("later keys overwrite earlier ones", () => {
      const yaml = `key: first\nkey: second`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({ key: "second" });
    });

    it("splits on first colon only", () => {
      const yaml = `key: value: with: colons`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({ key: "value: with: colons" });
    });
  });

  describe("error cases", () => {
    it("returns empty object for invalid JSON array", () => {
      const yaml = `items: [unclosed array`;
      const result = parseSimpleYaml(yaml);
      expect(result.items).toEqual([]);
    });

    it("returns empty array for invalid JSON array value", () => {
      const yaml = `items: [invalid}`;
      const result = parseSimpleYaml(yaml);
      expect(result.items).toEqual([]);
    });

    it("handles block list with tab indentation", () => {
      const yaml = `items:\n\t- first\n\t- second`;
      const result = parseSimpleYaml(yaml);
      expect(result.items).toEqual(["first", "second"]);
    });

    it("handles empty value with no block following", () => {
      const yaml = `key:\nfoo: bar`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({ key: [], foo: "bar" });
    });

    it("handles empty YAML", () => {
      const result = parseSimpleYaml("");
      expect(result).toEqual({});
    });

    it("handles YAML with only comments", () => {
      const yaml = `# comment\n# another comment`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({});
    });

    it("handles YAML with only blank lines", () => {
      const yaml = `\n\n\n`;
      const result = parseSimpleYaml(yaml);
      expect(result).toEqual({});
    });
  });

  describe("complex scenarios from contract", () => {
    it("handles state.yaml structure", () => {
      const yaml = `updated: 2026-08-07
sessions_active: 1
open:
  - item1
  - item2
blocked: []
god_nodes_recent:
  - node1
recent_context:
  - ctx1`;
      const result = parseSimpleYaml(yaml);
      expect(result.updated).toBe("2026-08-07");
      expect(result.sessions_active).toBe("1");
      expect(result.open).toEqual(["item1", "item2"]);
      expect(result.blocked).toEqual([]);
      expect(result.god_nodes_recent).toEqual(["node1"]);
      expect(result.recent_context).toEqual(["ctx1"]);
    });

    it("preserves order of keys", () => {
      const yaml = `z: last\na: first\nm: middle`;
      const result = parseSimpleYaml(yaml);
      const keys = Object.keys(result);
      expect(keys).toEqual(["z", "a", "m"]);
    });

    it("handles mixed block lists and regular values", () => {
      const yaml = `scope:
  - file1.ts
  - file2.ts
god_nodes_touched:
  - node1
open: []
topics: dashboard rebuild`;
      const result = parseSimpleYaml(yaml);
      expect(result.scope).toEqual(["file1.ts", "file2.ts"]);
      expect(result.god_nodes_touched).toEqual(["node1"]);
      expect(result.open).toEqual([]);
      expect(result.topics).toBe("dashboard rebuild");
    });
  });
});
