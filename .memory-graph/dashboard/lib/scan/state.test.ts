import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { stateYaml } from "@/lib/scan/state";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("stateYaml", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("happy paths", () => {
    it("returns present true when state.yaml exists", () => {
      sandbox.write("memory/state.yaml", "updated: 2026-08-07\n");
      const result = stateYaml(sandbox.root);

      expect(result.present).toBe(true);
    });

    it("parses updated field", () => {
      sandbox.write("memory/state.yaml", "updated: 2026-08-07\n");
      const result = stateYaml(sandbox.root);

      expect(result.updated).toBe("2026-08-07");
    });

    it("parses sessions_active as number", () => {
      sandbox.write("memory/state.yaml", "updated: 2026-08-07\nsessions_active: 2\n");
      const result = stateYaml(sandbox.root);

      expect(result.sessions_active).toBe(2);
      expect(typeof result.sessions_active).toBe("number");
    });

    it("parses arrays from block lists", () => {
      sandbox.write(
        "memory/state.yaml",
        `updated: 2026-08-07
open:
  - item1
  - item2
blocked: []`
      );
      const result = stateYaml(sandbox.root);

      expect(result.open).toEqual(["item1", "item2"]);
      expect(result.blocked).toEqual([]);
    });

    it("has correct key order", () => {
      sandbox.write(
        "memory/state.yaml",
        `updated: 2026-08-07
sessions_active: 1
open: []
blocked: []
god_nodes_recent: []
recent_context: []`
      );
      const result = stateYaml(sandbox.root);

      const keys = Object.keys(result);
      expect(keys).toEqual([
        "present",
        "updated",
        "sessions_active",
        "open",
        "blocked",
        "god_nodes_recent",
        "recent_context",
      ]);
    });
  });

  describe("absent file", () => {
    it("returns present false when state.yaml missing", () => {
      const result = stateYaml(sandbox.root);

      expect(result.present).toBe(false);
    });

    it("returns expected absent shape", () => {
      const result = stateYaml(sandbox.root);

      expect(result).toEqual({
        present: false,
        updated: null,
        sessions_active: null,
        open: [],
        blocked: [],
        god_nodes_recent: [],
        recent_context: [],
      });
    });
  });

  describe("empty state.yaml", () => {
    it("returns present true for empty file", () => {
      sandbox.write("memory/state.yaml", "");
      const result = stateYaml(sandbox.root);

      expect(result.present).toBe(true);
    });

    it("returns all defaults when file is empty", () => {
      sandbox.write("memory/state.yaml", "");
      const result = stateYaml(sandbox.root);

      expect(result.updated).toBeNull();
      expect(result.sessions_active).toBeNull();
      expect(result.open).toEqual([]);
      expect(result.blocked).toEqual([]);
      expect(result.god_nodes_recent).toEqual([]);
      expect(result.recent_context).toEqual([]);
    });
  });

  describe("missing individual fields", () => {
    it("defaults open to empty array when missing", () => {
      sandbox.write("memory/state.yaml", "updated: 2026-08-07\n");
      const result = stateYaml(sandbox.root);

      expect(result.open).toEqual([]);
    });

    it("defaults blocked to empty array when missing", () => {
      sandbox.write("memory/state.yaml", "updated: 2026-08-07\n");
      const result = stateYaml(sandbox.root);

      expect(result.blocked).toEqual([]);
    });

    it("defaults god_nodes_recent to empty array when missing", () => {
      sandbox.write("memory/state.yaml", "updated: 2026-08-07\n");
      const result = stateYaml(sandbox.root);

      expect(result.god_nodes_recent).toEqual([]);
    });

    it("defaults recent_context to empty array when missing", () => {
      sandbox.write("memory/state.yaml", "updated: 2026-08-07\n");
      const result = stateYaml(sandbox.root);

      expect(result.recent_context).toEqual([]);
    });
  });

  describe("sessions_active coercion", () => {
    it("returns null when sessions_active is not a numeric string", () => {
      sandbox.write("memory/state.yaml", "sessions_active: draft\n");
      const result = stateYaml(sandbox.root);

      expect(result.sessions_active).toBeNull();
    });

    it("returns null when sessions_active is missing", () => {
      sandbox.write("memory/state.yaml", "updated: 2026-08-07\n");
      const result = stateYaml(sandbox.root);

      expect(result.sessions_active).toBeNull();
    });

    it("parses numeric string to number", () => {
      sandbox.write("memory/state.yaml", "sessions_active: 42\n");
      const result = stateYaml(sandbox.root);

      expect(result.sessions_active).toBe(42);
      expect(typeof result.sessions_active).toBe("number");
    });

    it("parses zero", () => {
      sandbox.write("memory/state.yaml", "sessions_active: 0\n");
      const result = stateYaml(sandbox.root);

      expect(result.sessions_active).toBe(0);
    });
  });

  describe("array coercion", () => {
    it("coerces scalar to empty array", () => {
      sandbox.write("memory/state.yaml", "open: scalar\n");
      const result = stateYaml(sandbox.root);

      expect(result.open).toEqual([]);
    });

    it("coerces non-array values to empty array", () => {
      sandbox.write("memory/state.yaml", "blocked: 123\n");
      const result = stateYaml(sandbox.root);

      expect(result.blocked).toEqual([]);
    });

    it("preserves arrays from block list", () => {
      sandbox.write("memory/state.yaml", "open:\n  - a\n  - b\n");
      const result = stateYaml(sandbox.root);

      expect(result.open).toEqual(["a", "b"]);
    });

    it("preserves arrays from JSON", () => {
      sandbox.write("memory/state.yaml", 'open: ["x", "y"]\n');
      const result = stateYaml(sandbox.root);

      expect(result.open).toEqual(["x", "y"]);
    });
  });

  describe("fixture: full state.yaml", () => {
    it("matches contract fixture exactly", () => {
      sandbox.write(
        "memory/state.yaml",
        `updated: 2026-08-07
sessions_active: 1
open:
  - item1
blocked: []
god_nodes_recent:
  - node1
recent_context:
  - ctx1`
      );
      const result = stateYaml(sandbox.root);

      expect(result).toEqual({
        present: true,
        updated: "2026-08-07",
        sessions_active: 1,
        open: ["item1"],
        blocked: [],
        god_nodes_recent: ["node1"],
        recent_context: ["ctx1"],
      });
    });
  });

  describe("edge cases", () => {
    it("handles updated field as string", () => {
      sandbox.write("memory/state.yaml", "updated: 2026-08-07\n");
      const result = stateYaml(sandbox.root);

      expect(typeof result.updated).toBe("string");
    });

    it("handles multiple empty arrays", () => {
      sandbox.write(
        "memory/state.yaml",
        `updated: 2026-08-07
open: []
blocked: []
god_nodes_recent: []
recent_context: []`
      );
      const result = stateYaml(sandbox.root);

      expect(result.open).toEqual([]);
      expect(result.blocked).toEqual([]);
      expect(result.god_nodes_recent).toEqual([]);
      expect(result.recent_context).toEqual([]);
    });

    it("never throws", () => {
      expect(() => {
        stateYaml(sandbox.root);
      }).not.toThrow();
    });
  });
});
