import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync } from "fs";
import path from "path";
import { sessions } from "@/lib/scan/sessions";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("sessions", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("happy paths", () => {
    it("returns present true when sessions directory exists", () => {
      sandbox.mkdir("sessions");

      const result = sessions(sandbox.root);

      expect(result.present).toBe(true);
      expect(result.count).toBe(0);
    });

    it("returns present false when sessions directory is missing", () => {
      const result = sessions(sandbox.root);

      expect(result.present).toBe(false);
    });

    it("returns count 0 and empty items when no sessions", () => {
      const result = sessions(sandbox.root);

      expect(result.count).toBe(0);
      expect(result.items).toEqual([]);
    });

    it("parses frontmatter YAML from session file", () => {
      sandbox.write(
        "sessions/2026-08-07-1.md",
        `---
date: 2026-08-07
time: "14:02"
session: 1
topics: dashboard
context: testing
scope: []
god_nodes_touched: []
open: []
blocked: []
---
body`
      );
      const result = sessions(sandbox.root);

      expect(result.count).toBe(1);
      expect(result.items.length).toBe(1);
      expect(result.items[0].date).toBe("2026-08-07");
      expect(result.items[0].time).toBe("14:02");
    });

    it("has correct key order in session item", () => {
      sandbox.write(
        "sessions/2026-08-07-1.md",
        `---
date: 2026-08-07
session: 1
---
`
      );
      const result = sessions(sandbox.root);
      const keys = Object.keys(result.items[0]);

      expect(keys).toEqual([
        "file",
        "date",
        "time",
        "session",
        "topics",
        "context",
        "scope",
        "god_nodes_touched",
        "open",
        "blocked",
      ]);
    });

    it("includes relative path in file field", () => {
      sandbox.write(
        "sessions/2026-08-07-1.md",
        `---
date: 2026-08-07
---
`
      );
      const result = sessions(sandbox.root);

      expect(result.items[0].file).toBe("sessions/2026-08-07-1.md");
    });
  });

  describe("file ordering", () => {
    it("sorts filenames descending by code point", () => {
      sandbox.write("sessions/2026-08-05-1.md", "---\ndate: 2026-08-05\n---\n");
      sandbox.write("sessions/2026-08-07-2.md", "---\ndate: 2026-08-07\n---\n");
      sandbox.write("sessions/2026-08-06-1.md", "---\ndate: 2026-08-06\n---\n");

      const result = sessions(sandbox.root);

      expect(result.items[0].date).toBe("2026-08-07");
      expect(result.items[1].date).toBe("2026-08-06");
      expect(result.items[2].date).toBe("2026-08-05");
    });

    it("fixture ordering matches contract", () => {
      sandbox.write(
        "sessions/2026-08-07-2.md",
        `---
date: 2026-08-07
time: "14:02"
session: 2
topics: "dashboard rebuild"
context: "ported the collectors"
scope:
  - "dashboard/lib/scan/graph.ts"
  - "dashboard/lib/scan/tiers.ts"
god_nodes_touched:
  - "scan.py"
open:
  - "charts"
blocked: []
---
body text`
      );
      sandbox.write("sessions/2026-08-05-1.md", "---\ndate: 2026-08-05\n---\n");
      sandbox.write("sessions/2026-08-06-1.md", "---\ndate: 2026-08-06\n---\n");

      const result = sessions(sandbox.root);

      expect(result.count).toBe(3);
      expect(result.items[0].file).toBe("sessions/2026-08-07-2.md");
      expect(result.items[1].file).toBe("sessions/2026-08-06-1.md");
      expect(result.items[2].file).toBe("sessions/2026-08-05-1.md");
    });
  });

  describe("limit parameter", () => {
    it("defaults to 20 when not provided", () => {
      for (let i = 0; i < 25; i++) {
        sandbox.write(
          `sessions/2026-08-01-${i}.md`,
          `---\ndate: 2026-08-01\n---\n`
        );
      }

      const result = sessions(sandbox.root);

      expect(result.count).toBe(25);
      expect(result.items.length).toBe(20);
    });

    it("respects custom limit", () => {
      for (let i = 0; i < 25; i++) {
        sandbox.write(
          `sessions/2026-08-01-${i}.md`,
          `---\ndate: 2026-08-01\n---\n`
        );
      }

      const result = sessions(sandbox.root, 10);

      expect(result.count).toBe(25);
      expect(result.items.length).toBe(10);
    });

    it("fixture limit test: 25 files with limit 20", () => {
      for (let i = 0; i < 25; i++) {
        sandbox.write(
          `sessions/2026-08-01-${String(i).padStart(2, "0")}.md`,
          `---\ndate: 2026-08-01\n---\n`
        );
      }

      const result = sessions(sandbox.root, 20);

      expect(result.count).toBe(25);
      expect(result.items.length).toBe(20);
    });
  });

  describe("field parsing", () => {
    it("parses date field", () => {
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");
      const result = sessions(sandbox.root);

      expect(result.items[0].date).toBe("2026-08-07");
    });

    it("parses time field or defaults to empty string", () => {
      sandbox.write(
        "sessions/2026-08-07-1.md",
        "---\ndate: 2026-08-07\ntime: 14:02\n---\n"
      );
      const result = sessions(sandbox.root);

      expect(result.items[0].time).toBe("14:02");
    });

    it("defaults time to empty string when missing", () => {
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");
      const result = sessions(sandbox.root);

      expect(result.items[0].time).toBe("");
    });

    it("parses session as number if numeric string", () => {
      sandbox.write(
        "sessions/2026-08-07-1.md",
        "---\ndate: 2026-08-07\nsession: 42\n---\n"
      );
      const result = sessions(sandbox.root);

      expect(result.items[0].session).toBe(42);
      expect(typeof result.items[0].session).toBe("number");
    });

    it("keeps session as string if not numeric", () => {
      sandbox.write(
        "sessions/2026-08-07-1.md",
        "---\ndate: 2026-08-07\nsession: draft\n---\n"
      );
      const result = sessions(sandbox.root);

      expect(result.items[0].session).toBe("draft");
      expect(typeof result.items[0].session).toBe("string");
    });

    it("defaults session to null when missing", () => {
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");
      const result = sessions(sandbox.root);

      expect(result.items[0].session).toBeNull();
    });

    it("parses topics field", () => {
      sandbox.write(
        "sessions/2026-08-07-1.md",
        "---\ndate: 2026-08-07\ntopics: dashboard rebuild\n---\n"
      );
      const result = sessions(sandbox.root);

      expect(result.items[0].topics).toBe("dashboard rebuild");
    });

    it("defaults topics to empty string when missing", () => {
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");
      const result = sessions(sandbox.root);

      expect(result.items[0].topics).toBe("");
    });

    it("parses context field", () => {
      sandbox.write(
        "sessions/2026-08-07-1.md",
        "---\ndate: 2026-08-07\ncontext: testing framework\n---\n"
      );
      const result = sessions(sandbox.root);

      expect(result.items[0].context).toBe("testing framework");
    });

    it("defaults context to empty string when missing", () => {
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");
      const result = sessions(sandbox.root);

      expect(result.items[0].context).toBe("");
    });

    it("parses scope array", () => {
      sandbox.write(
        "sessions/2026-08-07-1.md",
        `---
date: 2026-08-07
scope:
  - "dashboard/lib/scan/graph.ts"
  - "dashboard/lib/scan/tiers.ts"
---
`
      );
      const result = sessions(sandbox.root);

      expect(result.items[0].scope).toEqual([
        "dashboard/lib/scan/graph.ts",
        "dashboard/lib/scan/tiers.ts",
      ]);
    });

    it("defaults scope to empty array when missing", () => {
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");
      const result = sessions(sandbox.root);

      expect(result.items[0].scope).toEqual([]);
    });

    it("parses all array fields", () => {
      sandbox.write(
        "sessions/2026-08-07-1.md",
        `---
date: 2026-08-07
god_nodes_touched:
  - node1
open:
  - item1
blocked:
  - item2
---
`
      );
      const result = sessions(sandbox.root);

      expect(result.items[0].god_nodes_touched).toEqual(["node1"]);
      expect(result.items[0].open).toEqual(["item1"]);
      expect(result.items[0].blocked).toEqual(["item2"]);
    });

    it("defaults all arrays to empty when missing", () => {
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");
      const result = sessions(sandbox.root);

      expect(result.items[0].god_nodes_touched).toEqual([]);
      expect(result.items[0].open).toEqual([]);
      expect(result.items[0].blocked).toEqual([]);
    });
  });

  describe("error cases", () => {
    it("skips file without leading ---", () => {
      sandbox.write("sessions/no-frontmatter.md", "no frontmatter\n");
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");

      const result = sessions(sandbox.root);

      expect(result.count).toBe(1);
      expect(result.items[0].file).toBe("sessions/2026-08-07-1.md");
    });

    it("skips file without closing ---", () => {
      sandbox.write("sessions/unclosed.md", "---\ndate: 2026-08-07\n");
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");

      const result = sessions(sandbox.root);

      expect(result.count).toBe(1);
    });

    it("skips file without date field", () => {
      sandbox.write("sessions/no-date.md", "---\ntime: 14:02\n---\n");
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");

      const result = sessions(sandbox.root);

      expect(result.count).toBe(1);
    });

    it("ignores sessions/archive/ directory", () => {
      sandbox.write("sessions/archive/old.md", "---\ndate: 2026-08-01\n---\n");
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");

      const result = sessions(sandbox.root);

      expect(result.count).toBe(1);
    });

    it("only reads direct children, not subdirectories", () => {
      sandbox.write(
        "sessions/subdir/nested.md",
        "---\ndate: 2026-08-07\n---\n"
      );
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");

      const result = sessions(sandbox.root);

      expect(result.count).toBe(1);
    });

    it("returns present false when sessions directory missing", () => {
      sandbox.root = sandbox.root + "/nonexistent";
      const result = sessions(sandbox.root);

      expect(result.present).toBe(false);
      expect(result.count).toBe(0);
      expect(result.items).toEqual([]);
    });

    it("returns present false when sessions is a file", () => {
      // makeSandbox() pre-creates sessions/ as a directory; remove it first
      // so we can replace it with a plain file for this fixture.
      rmSync(path.join(sandbox.root, "sessions"), { recursive: true, force: true });
      sandbox.write("sessions", "not a directory");
      const result = sessions(sandbox.root);

      expect(result.present).toBe(false);
    });

    it("never throws", () => {
      expect(() => {
        sessions("/nonexistent/path");
      }).not.toThrow();
    });
  });

  describe("fixture: session item", () => {
    it("matches contract fixture exactly", () => {
      sandbox.write(
        "sessions/2026-08-07-2.md",
        `---
date: 2026-08-07
time: "14:02"
session: 2
topics: "dashboard rebuild"
context: "ported the collectors"
scope:
  - "dashboard/lib/scan/graph.ts"
  - "dashboard/lib/scan/tiers.ts"
god_nodes_touched:
  - "scan.py"
open:
  - "charts"
blocked: []
---
body text`
      );

      const result = sessions(sandbox.root);

      expect(result.items[0]).toEqual({
        file: "sessions/2026-08-07-2.md",
        date: "2026-08-07",
        time: "14:02",
        session: 2,
        topics: "dashboard rebuild",
        context: "ported the collectors",
        scope: ["dashboard/lib/scan/graph.ts", "dashboard/lib/scan/tiers.ts"],
        god_nodes_touched: ["scan.py"],
        open: ["charts"],
        blocked: [],
      });
    });
  });

  describe("edge cases", () => {
    it("ignores non-.md files", () => {
      sandbox.write("sessions/not-markdown.txt", "---\ndate: 2026-08-07\n---\n");
      sandbox.write("sessions/2026-08-07-1.md", "---\ndate: 2026-08-07\n---\n");

      const result = sessions(sandbox.root);

      expect(result.count).toBe(1);
    });
  });
});
