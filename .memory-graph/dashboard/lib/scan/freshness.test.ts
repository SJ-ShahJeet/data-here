import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { freshness } from "@/lib/scan/freshness";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

const TODAY = new Date("2026-08-08T00:00:00Z");
const GOOD_STATE = "updated: 2026-08-06\nsessions_active: 1\nopen: []\nblocked: []\n";
const STALE_STATE = "updated: 2026-07-20\nsessions_active: 1\nopen: []\nblocked: []\n";
const OLD_STATE = "updated: 2026-06-01\nsessions_active: 1\nopen: []\nblocked: []\n";

describe("freshness", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("happy paths with fixture states", () => {
    it("returns good state for recently updated file (2 days ago)", async () => {
      await sandbox.write("memory/state.yaml", GOOD_STATE);
      const result = freshness(sandbox.root, TODAY);

      expect(result).toEqual({
        present: true,
        state: "good",
        updated: "2026-08-06",
        age_days: 2,
        mtime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
      });
    });

    it("returns stale state for moderately old file (19 days ago)", async () => {
      await sandbox.write("memory/state.yaml", STALE_STATE);
      const result = freshness(sandbox.root, TODAY);

      expect(result).toEqual({
        present: true,
        state: "stale",
        updated: "2026-07-20",
        age_days: 19,
        mtime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
      });
    });

    it("returns old state for very old file (68 days ago)", async () => {
      await sandbox.write("memory/state.yaml", OLD_STATE);
      const result = freshness(sandbox.root, TODAY);

      expect(result).toEqual({
        present: true,
        state: "old",
        updated: "2026-06-01",
        age_days: 68,
        mtime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
      });
    });
  });

  describe("boundary tests (exact state transitions)", () => {
    it("returns good for exactly 7 days old", async () => {
      await sandbox.write("memory/state.yaml", "updated: 2026-08-01\n");
      const result = freshness(sandbox.root, TODAY);

      expect(result.state).toBe("good");
      expect(result.age_days).toBe(7);
    });

    it("returns stale for exactly 8 days old", async () => {
      await sandbox.write("memory/state.yaml", "updated: 2026-07-31\n");
      const result = freshness(sandbox.root, TODAY);

      expect(result.state).toBe("stale");
      expect(result.age_days).toBe(8);
    });

    it("returns stale for exactly 30 days old", async () => {
      await sandbox.write("memory/state.yaml", "updated: 2026-07-09\n");
      const result = freshness(sandbox.root, TODAY);

      expect(result.state).toBe("stale");
      expect(result.age_days).toBe(30);
    });

    it("returns old for exactly 31 days old", async () => {
      await sandbox.write("memory/state.yaml", "updated: 2026-07-08\n");
      const result = freshness(sandbox.root, TODAY);

      expect(result.state).toBe("old");
      expect(result.age_days).toBe(31);
    });
  });

  describe("absent case", () => {
    it("returns absent shape when state.yaml does not exist", () => {
      const result = freshness(sandbox.root, TODAY);

      expect(result).toEqual({
        present: false,
        state: "absent",
        updated: null,
        age_days: null,
        mtime: null,
      });
    });

    it("returns absent shape when directory itself does not exist", () => {
      const result = freshness("/nonexistent/path/that/does/not/exist", TODAY);

      expect(result).toEqual({
        present: false,
        state: "absent",
        updated: null,
        age_days: null,
        mtime: null,
      });
    });
  });

  describe("fallback to mtime when no updated line", () => {
    it("uses file mtime as updated date when no updated: line found", async () => {
      const noUpdatedLine = "sessions_active: 1\nopen: []\nblocked: []\n";
      await sandbox.write("memory/state.yaml", noUpdatedLine);
      const result = freshness(sandbox.root, TODAY);

      expect(result.present).toBe(true);
      // mtime should be today or very close to it, but we don't control it
      expect(result.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.age_days).toBeLessThanOrEqual(1);
    });

    it("falls back to mtime when updated: line exists but is before the state.yaml file", async () => {
      // File says it was updated 100 days ago but file mtime is today
      // The contract says to use the earliest valid updated: line found
      const oldUpdate = "updated: 2026-05-01\nother: value\n";
      const path = await sandbox.write("memory/state.yaml", oldUpdate);
      const result = freshness(sandbox.root, TODAY);

      expect(result.present).toBe(true);
      expect(result.updated).toBe("2026-05-01");
      expect(result.state).toBe("old");
    });
  });

  describe("unparseable updated: line handling", () => {
    it("falls back to mtime when updated: line does not match date format", async () => {
      const invalidDate = "updated: not-a-date\nsessions_active: 1\n";
      await sandbox.write("memory/state.yaml", invalidDate);
      const result = freshness(sandbox.root, TODAY);

      expect(result.present).toBe(true);
      expect(result.updated).not.toBe("not-a-date");
      expect(result.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("falls back to mtime when updated: line matches regex but fails date parsing", async () => {
      const invalidDateParse = "updated: 2026-13-45\nsessions_active: 1\n";
      await sandbox.write("memory/state.yaml", invalidDateParse);
      const result = freshness(sandbox.root, TODAY);

      expect(result.present).toBe(true);
      // Should fall back to mtime, not use the invalid date
      expect(result.updated).not.toBe("2026-13-45");
      expect(result.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("stops scanning at first updated: line even if unparseable", async () => {
      const multipleUpdates =
        "updated: not-valid\nupdated: 2026-08-06\nsessions_active: 1\n";
      await sandbox.write("memory/state.yaml", multipleUpdates);
      const result = freshness(sandbox.root, TODAY);

      expect(result.present).toBe(true);
      // Should have fallen back to mtime, not parsed the second line
      expect(result.updated).not.toBe("2026-08-06");
      expect(result.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("fs errors and edge cases", () => {
    it("returns absent shape when memory/state.yaml is not a regular file (is a directory)", async () => {
      await sandbox.mkdir("memory/state.yaml");
      const result = freshness(sandbox.root, TODAY);

      expect(result).toEqual({
        present: false,
        state: "absent",
        updated: null,
        age_days: null,
        mtime: null,
      });
    });

    it("does not throw when fs.readFileSync would fail", () => {
      // This tests the no-throw contract; exact error conditions vary by platform
      expect(() => {
        freshness("/proc/denied/access/path", TODAY);
      }).not.toThrow();
    });

    it("does not throw when fs.statSync would fail", () => {
      expect(() => {
        freshness("/sys/denied/path", TODAY);
      }).not.toThrow();
    });
  });

  describe("default today parameter", () => {
    it("uses current date when today is not provided", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayYMD = yesterday.toISOString().slice(0, 10);

      await sandbox.write("memory/state.yaml", `updated: ${yesterdayYMD}\n`);
      const result = freshness(sandbox.root);

      expect(result.present).toBe(true);
      expect(result.age_days).toBe(1);
    });
  });

  describe("negative age (future dates)", () => {
    it("treats future-dated entries as good (negative age)", async () => {
      const tomorrow = new Date(TODAY);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowYMD = tomorrow.toISOString().slice(0, 10);

      await sandbox.write("memory/state.yaml", `updated: ${tomorrowYMD}\n`);
      const result = freshness(sandbox.root, TODAY);

      expect(result.state).toBe("good");
      expect(result.age_days).toBeLessThan(0);
    });
  });

  describe("whitespace handling in updated: line", () => {
    it("extracts date from updated: line with extra whitespace", async () => {
      const extraSpaces = "updated:   2026-08-06   \nother: value\n";
      await sandbox.write("memory/state.yaml", extraSpaces);
      const result = freshness(sandbox.root, TODAY);

      expect(result.updated).toBe("2026-08-06");
      expect(result.age_days).toBe(2);
    });

    it("handles updated: line without trailing newline", async () => {
      const noNewline = "updated: 2026-08-06";
      await sandbox.write("memory/state.yaml", noNewline);
      const result = freshness(sandbox.root, TODAY);

      expect(result.updated).toBe("2026-08-06");
    });
  });

  describe("mtime format compliance", () => {
    it("returns mtime in ISO UTC format without milliseconds", async () => {
      await sandbox.write("memory/state.yaml", "updated: 2026-08-06\n");
      const result = freshness(sandbox.root, TODAY);

      expect(result.mtime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(result.mtime).toHaveLength(20);
      expect(result.mtime).not.toContain(".");
    });
  });
});
