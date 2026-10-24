import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tiers } from "@/lib/scan/tiers";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("tiers", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("happy paths", () => {
    it("returns tiers object with four keys", () => {
      const result = tiers(sandbox.root);

      expect(Object.keys(result)).toEqual(["hot", "warm", "cold", "brief"]);
    });

    it("hot tier tracks memory/state.yaml", () => {
      sandbox.write("memory/state.yaml", "updated: 2026-08-07\n");
      const result = tiers(sandbox.root);

      expect(result.hot.present).toBe(true);
      expect(result.hot.path).toBe("memory/state.yaml");
      expect(result.hot.bytes).toBeGreaterThan(0);
    });

    it("brief tier tracks memory/.agent-brief.yaml", () => {
      sandbox.write("memory/.agent-brief.yaml", "brief content");
      const result = tiers(sandbox.root);

      expect(result.brief.present).toBe(true);
      expect(result.brief.path).toBe("memory/.agent-brief.yaml");
      expect(result.brief.bytes).toBeGreaterThan(0);
    });

    it("warm tier counts sessions/*.md files", () => {
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");
      sandbox.write("sessions/2026-08-06-1.md", "---\ndate: 2026-08-06\n---\n");

      const result = tiers(sandbox.root);

      expect(result.warm.count).toBe(2);
      expect(result.warm.path).toBe("sessions/");
      expect(result.warm.bytes).toBeGreaterThan(0);
    });

    it("cold tier counts sessions/archive/*.yaml and *.md", () => {
      sandbox.write("sessions/archive/old.yaml", "archived content");
      sandbox.write("sessions/archive/old.md", "---\ndate: 2026-08-01\n---\n");

      const result = tiers(sandbox.root);

      expect(result.cold.count).toBe(2);
      expect(result.cold.path).toBe("sessions/archive/");
      expect(result.cold.bytes).toBeGreaterThan(0);
    });

    it("returns zero bytes when files absent", () => {
      const result = tiers(sandbox.root);

      expect(result.hot.bytes).toBe(0);
      expect(result.brief.bytes).toBe(0);
      expect(result.warm.bytes).toBe(0);
      expect(result.cold.bytes).toBe(0);
    });
  });

  describe("hot tier", () => {
    it("returns present false when memory/state.yaml missing", () => {
      const result = tiers(sandbox.root);

      expect(result.hot.present).toBe(false);
      expect(result.hot.bytes).toBe(0);
    });

    it("has size of state.yaml file", () => {
      const content = "updated: 2026-08-07\nsessions_active: 5\n";
      sandbox.write("memory/state.yaml", content);

      const result = tiers(sandbox.root);

      expect(result.hot.present).toBe(true);
      expect(result.hot.bytes).toBe(Buffer.byteLength(content, "utf8"));
    });

    it("path is always memory/state.yaml", () => {
      sandbox.write("memory/state.yaml", "x");
      const result = tiers(sandbox.root);

      expect(result.hot.path).toBe("memory/state.yaml");
    });
  });

  describe("brief tier", () => {
    it("returns present false when memory/.agent-brief.yaml missing", () => {
      const result = tiers(sandbox.root);

      expect(result.brief.present).toBe(false);
      expect(result.brief.bytes).toBe(0);
    });

    it("has size of .agent-brief.yaml file", () => {
      const content = "brief: content here";
      sandbox.write("memory/.agent-brief.yaml", content);

      const result = tiers(sandbox.root);

      expect(result.brief.present).toBe(true);
      expect(result.brief.bytes).toBe(Buffer.byteLength(content, "utf8"));
    });

    it("path is always memory/.agent-brief.yaml", () => {
      sandbox.write("memory/.agent-brief.yaml", "x");
      const result = tiers(sandbox.root);

      expect(result.brief.path).toBe("memory/.agent-brief.yaml");
    });
  });

  describe("warm tier (sessions)", () => {
    it("counts only direct .md children", () => {
      sandbox.write("sessions/2026-08-07-1.md", "session 1");
      sandbox.write("sessions/2026-08-06-1.md", "session 2");
      sandbox.write("sessions/archive/old.md", "archived"); // not counted

      const result = tiers(sandbox.root);

      expect(result.warm.count).toBe(2);
    });

    it("sums bytes of all direct .md children", () => {
      const content1 = "session 1 content";
      const content2 = "session 2 content";
      sandbox.write("sessions/2026-08-07-1.md", content1);
      sandbox.write("sessions/2026-08-06-1.md", content2);

      const result = tiers(sandbox.root);

      const expectedBytes =
        Buffer.byteLength(content1, "utf8") +
        Buffer.byteLength(content2, "utf8");
      expect(result.warm.bytes).toBe(expectedBytes);
    });

    it("ignores non-.md files in sessions", () => {
      sandbox.write("sessions/2026-08-07-1.md", "session");
      sandbox.write("sessions/2026-08-07-1.txt", "not counted");

      const result = tiers(sandbox.root);

      expect(result.warm.count).toBe(1);
    });

    it("path is always sessions/", () => {
      sandbox.write("sessions/2026-08-07-1.md", "x");
      const result = tiers(sandbox.root);

      expect(result.warm.path).toBe("sessions/");
    });

    it("returns zeroes when sessions directory missing", () => {
      const result = tiers(sandbox.root);

      expect(result.warm.count).toBe(0);
      expect(result.warm.bytes).toBe(0);
    });
  });

  describe("cold tier (sessions/archive)", () => {
    it("counts .yaml and .md files in archive", () => {
      sandbox.write("sessions/archive/2026-08-01.yaml", "archived yaml");
      sandbox.write("sessions/archive/2026-08-02.md", "archived md");

      const result = tiers(sandbox.root);

      expect(result.cold.count).toBe(2);
    });

    it("ignores non-.yaml/.md files", () => {
      sandbox.write("sessions/archive/old.txt", "not counted");
      sandbox.write("sessions/archive/2026-08-01.yaml", "counted");

      const result = tiers(sandbox.root);

      expect(result.cold.count).toBe(1);
    });

    it("only reads direct children of archive", () => {
      sandbox.write(
        "sessions/archive/subdir/nested.yaml",
        "not counted"
      );
      sandbox.write("sessions/archive/2026-08-01.yaml", "counted");

      const result = tiers(sandbox.root);

      expect(result.cold.count).toBe(1);
    });

    it("sums bytes of all direct archive files", () => {
      const yaml = "yaml content";
      const md = "markdown content";
      sandbox.write("sessions/archive/old.yaml", yaml);
      sandbox.write("sessions/archive/old.md", md);

      const result = tiers(sandbox.root);

      const expectedBytes =
        Buffer.byteLength(yaml, "utf8") + Buffer.byteLength(md, "utf8");
      expect(result.cold.bytes).toBe(expectedBytes);
    });

    it("path is always sessions/archive/", () => {
      sandbox.write("sessions/archive/old.yaml", "x");
      const result = tiers(sandbox.root);

      expect(result.cold.path).toBe("sessions/archive/");
    });

    it("returns zeroes when archive missing", () => {
      const result = tiers(sandbox.root);

      expect(result.cold.count).toBe(0);
      expect(result.cold.bytes).toBe(0);
    });
  });

  describe("empty state", () => {
    it("returns all zeroes/empty when nothing exists", () => {
      const result = tiers(sandbox.root);

      expect(result.hot.present).toBe(false);
      expect(result.hot.bytes).toBe(0);
      expect(result.brief.present).toBe(false);
      expect(result.brief.bytes).toBe(0);
      expect(result.warm.count).toBe(0);
      expect(result.warm.bytes).toBe(0);
      expect(result.cold.count).toBe(0);
      expect(result.cold.bytes).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("never throws even on invalid paths", () => {
      expect(() => {
        tiers("/nonexistent/path");
      }).not.toThrow();
    });

    it("handles empty files", () => {
      sandbox.write("memory/state.yaml", "");
      const result = tiers(sandbox.root);

      expect(result.hot.present).toBe(true);
      expect(result.hot.bytes).toBe(0);
    });

    it("handles very large files", () => {
      const large = "x".repeat(10000);
      sandbox.write("memory/state.yaml", large);
      const result = tiers(sandbox.root);

      expect(result.hot.bytes).toBe(10000);
    });
  });

  describe("hot tier details", () => {
    it("hot tier has present and bytes properties", () => {
      const result = tiers(sandbox.root);

      expect(result.hot).toHaveProperty("present");
      expect(result.hot).toHaveProperty("bytes");
      expect(result.hot).toHaveProperty("path");
    });
  });

  describe("warm/cold tier details", () => {
    it("warm/cold tiers have count and bytes properties", () => {
      const result = tiers(sandbox.root);

      expect(result.warm).toHaveProperty("count");
      expect(result.warm).toHaveProperty("bytes");
      expect(result.warm).toHaveProperty("path");
      expect(result.cold).toHaveProperty("count");
      expect(result.cold).toHaveProperty("bytes");
      expect(result.cold).toHaveProperty("path");
    });
  });
});
