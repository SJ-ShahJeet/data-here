import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { compression, COMPRESSION_LOG_REL, COMPRESSION_MAX_ENTRIES } from "@/lib/scan/compression";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("compression", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("constants", () => {
    it("COMPRESSION_LOG_REL is memory/.compression-log.jsonl", () => {
      expect(COMPRESSION_LOG_REL).toBe("memory/.compression-log.jsonl");
    });

    it("COMPRESSION_MAX_ENTRIES is 200", () => {
      expect(COMPRESSION_MAX_ENTRIES).toBe(200);
    });
  });

  describe("happy paths", () => {
    it("returns present true when ledger exists", () => {
      sandbox.write("memory/.compression-log.jsonl", '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n');
      const result = compression(sandbox.root);

      expect(result.present).toBe(true);
    });

    it("parses JSON lines from ledger", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n{"at":"2026-08-07T11:00:00Z","tool":"Grep","before":800,"after":200}\n'
      );
      const result = compression(sandbox.root);

      expect(result.entries.length).toBe(2);
    });

    it("calculates saved bytes as Math.max(0, before - after)", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n'
      );
      const result = compression(sandbox.root);

      expect(result.entries[0].saved).toBe(500);
    });

    it("returns saved 0 when after > before", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":100,"after":500}\n'
      );
      const result = compression(sandbox.root);

      expect(result.entries[0].saved).toBe(0);
    });

    it("has correct entry key order: at, tool, before, after, saved", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n'
      );
      const result = compression(sandbox.root);

      const keys = Object.keys(result.entries[0]);
      expect(keys).toEqual(["at", "tool", "before", "after", "saved"]);
    });

    it("calculates total_before as sum of before values", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n{"at":"2026-08-07T11:00:00Z","tool":"Grep","before":800,"after":200}\n'
      );
      const result = compression(sandbox.root);

      expect(result.total_before).toBe(1800);
    });

    it("calculates total_after as sum of after values", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n{"at":"2026-08-07T11:00:00Z","tool":"Grep","before":800,"after":200}\n'
      );
      const result = compression(sandbox.root);

      expect(result.total_after).toBe(700);
    });

    it("calculates total_saved as sum of saved values", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n{"at":"2026-08-07T11:00:00Z","tool":"Grep","before":800,"after":200}\n'
      );
      const result = compression(sandbox.root);

      expect(result.total_saved).toBe(1100);
    });
  });

  describe("absent file", () => {
    it("returns present false when ledger missing", () => {
      const result = compression(sandbox.root);

      expect(result.present).toBe(false);
    });

    it("returns absent shape when missing", () => {
      const result = compression(sandbox.root);

      expect(result).toEqual({
        present: false,
        entries: [],
        total_before: 0,
        total_after: 0,
        total_saved: 0,
      });
    });
  });

  describe("invalid JSON handling", () => {
    it("skips invalid JSON lines", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        'not json at all\n{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n'
      );
      const result = compression(sandbox.root);

      expect(result.entries.length).toBe(1);
    });

    it("keeps valid lines around invalid ones", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\nnot json\n{"at":"2026-08-07T11:00:00Z","tool":"Grep","before":800,"after":200}\n'
      );
      const result = compression(sandbox.root);

      expect(result.entries.length).toBe(2);
      expect(result.entries[0].tool).toBe("Shell");
      expect(result.entries[1].tool).toBe("Grep");
    });
  });

  describe("record validation", () => {
    it("skips records missing at field", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"tool":"Shell","before":1000,"after":500}\n{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n'
      );
      const result = compression(sandbox.root);

      expect(result.entries.length).toBe(1);
    });

    it("skips records missing tool field", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","before":1000,"after":500}\n{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n'
      );
      const result = compression(sandbox.root);

      expect(result.entries.length).toBe(1);
    });

    it("skips records with non-numeric before", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":"not a number","after":500}\n{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n'
      );
      const result = compression(sandbox.root);

      expect(result.entries.length).toBe(1);
    });

    it("skips records with non-numeric after", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":"not a number"}\n{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n'
      );
      const result = compression(sandbox.root);

      expect(result.entries.length).toBe(1);
    });

    it("skips records with Infinity", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":Infinity,"after":500}\n{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n'
      );
      const result = compression(sandbox.root);

      expect(result.entries.length).toBe(1);
    });
  });

  describe("empty lines", () => {
    it("drops empty lines", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n\n{"at":"2026-08-07T11:00:00Z","tool":"Grep","before":800,"after":200}\n'
      );
      const result = compression(sandbox.root);

      expect(result.entries.length).toBe(2);
    });
  });

  describe("limit enforcement", () => {
    it("keeps only last 200 entries", () => {
      let ledger = "";
      for (let i = 0; i < 250; i++) {
        ledger += `{"at":"2026-08-07T${String(i).padStart(5, "0")}Z","tool":"Shell","before":1000,"after":500}\n`;
      }
      sandbox.write("memory/.compression-log.jsonl", ledger);

      const result = compression(sandbox.root);

      expect(result.entries.length).toBe(200);
    });

    it("keeps newest 200, drops oldest 50", () => {
      let ledger = "";
      for (let i = 0; i < 250; i++) {
        ledger += `{"at":"2026-08-07T${String(i).padStart(5, "0")}Z","tool":"Shell","before":${1000 + i},"after":500}\n`;
      }
      sandbox.write("memory/.compression-log.jsonl", ledger);

      const result = compression(sandbox.root);

      expect(result.entries.length).toBe(200);
      // Oldest kept should be from i=50
      expect(result.entries[0].before).toBe(1050);
      expect(result.entries[199].before).toBe(1249);
    });

    it("preserves chronological order in kept entries", () => {
      let ledger = "";
      for (let i = 0; i < 250; i++) {
        const hour = String(i % 24).padStart(2, "0");
        const day = Math.floor(i / 24);
        ledger += `{"at":"2026-08-${String(7 + day).padStart(2, "0")}T${hour}:00:00Z","tool":"Shell","before":1000,"after":500}\n`;
      }
      sandbox.write("memory/.compression-log.jsonl", ledger);

      const result = compression(sandbox.root);

      for (let i = 1; i < result.entries.length; i++) {
        expect(result.entries[i].at >= result.entries[i - 1].at).toBe(true);
      }
    });

    it("regression test for scan.py:490 bug", () => {
      // scan.py:490 took the OLDEST 50 instead of newest
      // This test verifies we keep the NEWEST 200
      let ledger = "";
      for (let i = 0; i < 250; i++) {
        ledger += `{"at":"2026-08-07T${String(i).padStart(5, "0")}Z","tool":"Tool${i}","before":${1000 + i},"after":500}\n`;
      }
      sandbox.write("memory/.compression-log.jsonl", ledger);

      const result = compression(sandbox.root);

      // Should have entries 50-249, not 0-49
      expect(result.entries[0].tool).toBe("Tool50");
      expect(result.entries[199].tool).toBe("Tool249");
    });
  });

  describe("fixture: compression ledger", () => {
    it("matches contract fixture exactly", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        `{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":9000,"after":1200}
{"at":"2026-08-07T11:00:00Z","tool":"Grep","before":7000,"after":900}
not json at all
{"at":"2026-08-07T12:00:00Z","tool":"Read","before":50,"after":80}
`
      );
      const result = compression(sandbox.root);

      expect(result.present).toBe(true);
      expect(result.entries.length).toBe(3);
      expect(result.entries[0].saved).toBe(7800);
      expect(result.entries[1].saved).toBe(6100);
      expect(result.entries[2].saved).toBe(0);
      expect(result.total_before).toBe(16050);
      expect(result.total_after).toBe(2180);
      expect(result.total_saved).toBe(13900);
    });
  });

  describe("edge cases", () => {
    it("handles single entry", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n'
      );
      const result = compression(sandbox.root);

      expect(result.entries.length).toBe(1);
      expect(result.present).toBe(true);
    });

    it("handles file with only empty lines", () => {
      sandbox.write("memory/.compression-log.jsonl", "\n\n\n");
      const result = compression(sandbox.root);

      expect(result.present).toBe(false);
      expect(result.entries.length).toBe(0);
    });

    it("handles file with only invalid JSON", () => {
      sandbox.write("memory/.compression-log.jsonl", "not json\nnot json\n");
      const result = compression(sandbox.root);

      expect(result.present).toBe(false);
      expect(result.entries.length).toBe(0);
    });

    it("never throws on read errors", () => {
      expect(() => {
        compression("/nonexistent/path");
      }).not.toThrow();
    });

    it("never throws on invalid JSON", () => {
      sandbox.write("memory/.compression-log.jsonl", "{invalid json}");
      expect(() => {
        compression(sandbox.root);
      }).not.toThrow();
    });
  });

  describe("result shape", () => {
    it("result is JSON stringifiable", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        '{"at":"2026-08-07T10:00:00Z","tool":"Shell","before":1000,"after":500}\n'
      );
      const result = compression(sandbox.root);

      expect(() => {
        JSON.stringify(result);
      }).not.toThrow();
    });
  });
});
