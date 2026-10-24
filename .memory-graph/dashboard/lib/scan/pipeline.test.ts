import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { pipeline } from "@/lib/scan/pipeline";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("pipeline", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("happy paths", () => {
    it("returns fixed four-element check array", () => {
      const result = pipeline(sandbox.root);
      expect(result.checks).toHaveLength(4);
    });

    it("has correct check names in order", () => {
      const result = pipeline(sandbox.root);
      const names = result.checks.map((c) => c.name);
      expect(names).toEqual([
        "agent_brief",
        "semantic_pending",
        "semantic_ollama",
        "graph_scout",
      ]);
    });

    it("has correct paths in order", () => {
      const result = pipeline(sandbox.root);
      const paths = result.checks.map((c) => c.path);
      expect(paths).toEqual([
        "memory/.agent-brief-status",
        "memory/.semantic-pending",
        "memory/.semantic-ollama-status",
        "memory/.graph-scout-status",
      ]);
    });

    it("returns object key order: name, path, present, mtime, detail", () => {
      const result = pipeline(sandbox.root);
      const keys = Object.keys(result.checks[0]);
      expect(keys).toEqual(["name", "path", "present", "mtime", "detail"]);
    });
  });

  describe("absent files", () => {
    it("returns present false when file does not exist", () => {
      const result = pipeline(sandbox.root);
      result.checks.forEach((check) => {
        expect(check.present).toBe(false);
        expect(check.mtime).toBeNull();
        expect(check.detail).toBe("");
      });
    });
  });

  describe("present files", () => {
    it("returns present true and ISO mtime when file exists", () => {
      sandbox.write("memory/.agent-brief-status", "ok: brief written\n");
      const result = pipeline(sandbox.root);
      const check = result.checks[0];

      expect(check.present).toBe(true);
      expect(check.mtime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    it("reads first line as detail", () => {
      sandbox.write(
        "memory/.agent-brief-status",
        "ok: brief written\nsecond line\nthird line\n"
      );
      const result = pipeline(sandbox.root);
      const check = result.checks[0];

      expect(check.detail).toBe("ok: brief written");
    });

    it("trims detail from first line", () => {
      sandbox.write(
        "memory/.agent-brief-status",
        "  ok: brief written  \nsecond line\n"
      );
      const result = pipeline(sandbox.root);
      const check = result.checks[0];

      expect(check.detail).toBe("ok: brief written");
    });

    it("returns empty detail for empty file", () => {
      sandbox.write("memory/.semantic-pending", "");
      const result = pipeline(sandbox.root);
      const check = result.checks[1];

      expect(check.present).toBe(true);
      expect(check.detail).toBe("");
    });
  });

  describe("multiple files present", () => {
    it("returns correct data for multiple checks", () => {
      sandbox.write("memory/.agent-brief-status", "agent: ok\n");
      sandbox.write("memory/.semantic-ollama-status", "ollama: ready\n");

      const result = pipeline(sandbox.root);

      expect(result.checks[0].present).toBe(true);
      expect(result.checks[0].detail).toBe("agent: ok");
      expect(result.checks[1].present).toBe(false);
      expect(result.checks[2].present).toBe(true);
      expect(result.checks[2].detail).toBe("ollama: ready");
      expect(result.checks[3].present).toBe(false);
    });
  });

  describe("fixture: pipeline status files", () => {
    it("matches contract fixture exactly", () => {
      sandbox.write("memory/.agent-brief-status", "ok: brief written\nsecond line\n");
      const result = pipeline(sandbox.root);
      const check = result.checks[0];

      expect(check.name).toBe("agent_brief");
      expect(check.path).toBe("memory/.agent-brief-status");
      expect(check.present).toBe(true);
      expect(check.mtime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(check.detail).toBe("ok: brief written");
    });

    it("all absent checks have consistent structure", () => {
      const result = pipeline(sandbox.root);
      const absentChecks = result.checks.slice(1);

      absentChecks.forEach((check) => {
        expect(check.present).toBe(false);
        expect(check.mtime).toBeNull();
        expect(check.detail).toBe("");
      });
    });
  });

  describe("edge cases", () => {
    it("handles single-line file", () => {
      sandbox.write("memory/.graph-scout-status", "status only");
      const result = pipeline(sandbox.root);
      const check = result.checks[3];

      expect(check.detail).toBe("status only");
    });

    it("handles file with only whitespace first line", () => {
      sandbox.write("memory/.semantic-pending", "   \nsext");
      const result = pipeline(sandbox.root);
      const check = result.checks[1];

      expect(check.detail).toBe("");
    });

    it("never throws even with missing memory directory", () => {
      sandbox.root = sandbox.root + "/nonexistent";
      expect(() => {
        pipeline(sandbox.root);
      }).not.toThrow();
    });
  });
});
