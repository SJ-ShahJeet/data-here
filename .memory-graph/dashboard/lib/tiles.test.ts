import { describe, it, expect } from "vitest";
import { freshnessTile } from "@/lib/tiles";
import type { Freshness } from "@/lib/scan/freshness";

describe("freshnessTile", () => {
  describe("absent state", () => {
    it("maps absent freshness to neutral tile", () => {
      const absent: Freshness = {
        present: false,
        state: "absent",
        updated: null,
        age_days: null,
        mtime: null,
      };

      const tile = freshnessTile(absent);

      expect(tile).toEqual({
        label: "Memory freshness",
        value: "—",
        sub: "no state.yaml yet",
        severity: "neutral",
        action: "No session has ended in this repo yet.",
      });
    });

    it("uses em dash character for absent value", () => {
      const absent: Freshness = {
        present: false,
        state: "absent",
        updated: null,
        age_days: null,
        mtime: null,
      };

      const tile = freshnessTile(absent);

      expect(tile.value).toBe("—");
      expect(tile.value).toHaveLength(1);
      expect(tile.value.charCodeAt(0)).toBe(0x2014); // U+2014 EM DASH
    });
  });

  describe("good state", () => {
    it("maps good freshness to good severity", () => {
      const good: Freshness = {
        present: true,
        state: "good",
        updated: "2026-08-06",
        age_days: 2,
        mtime: "2026-08-06T10:30:45Z",
      };

      const tile = freshnessTile(good);

      expect(tile).toEqual({
        label: "Memory freshness",
        value: "2d",
        sub: "updated 2026-08-06",
        severity: "good",
      });
    });

    it("formats age_days with d suffix", () => {
      const good: Freshness = {
        present: true,
        state: "good",
        updated: "2026-08-06",
        age_days: 0,
        mtime: "2026-08-08T00:00:00Z",
      };

      const tile = freshnessTile(good);

      expect(tile.value).toBe("0d");
    });

    it("handles 7-day boundary in good state", () => {
      const good: Freshness = {
        present: true,
        state: "good",
        updated: "2026-08-01",
        age_days: 7,
        mtime: "2026-08-01T12:00:00Z",
      };

      const tile = freshnessTile(good);

      expect(tile.severity).toBe("good");
      expect(tile.value).toBe("7d");
    });
  });

  describe("stale state", () => {
    it("maps stale freshness to warning severity", () => {
      const stale: Freshness = {
        present: true,
        state: "stale",
        updated: "2026-07-20",
        age_days: 19,
        mtime: "2026-07-20T08:45:30Z",
      };

      const tile = freshnessTile(stale);

      expect(tile).toEqual({
        label: "Memory freshness",
        value: "19d",
        sub: "last written 2026-07-20",
        severity: "warning",
        action:
          "Normal after a break. If you have been working here, the stop hook may not be firing.",
      });
    });

    it("uses 'last written' phrasing for stale state", () => {
      const stale: Freshness = {
        present: true,
        state: "stale",
        updated: "2026-07-15",
        age_days: 24,
        mtime: "2026-07-15T14:20:00Z",
      };

      const tile = freshnessTile(stale);

      expect(tile.sub).toContain("last written");
    });

    it("handles 8-day boundary in stale state", () => {
      const stale: Freshness = {
        present: true,
        state: "stale",
        updated: "2026-07-31",
        age_days: 8,
        mtime: "2026-07-31T18:00:00Z",
      };

      const tile = freshnessTile(stale);

      expect(tile.severity).toBe("warning");
      expect(tile.value).toBe("8d");
    });

    it("handles 30-day boundary in stale state", () => {
      const stale: Freshness = {
        present: true,
        state: "stale",
        updated: "2026-07-09",
        age_days: 30,
        mtime: "2026-07-09T00:00:00Z",
      };

      const tile = freshnessTile(stale);

      expect(tile.severity).toBe("warning");
      expect(tile.value).toBe("30d");
    });
  });

  describe("old state", () => {
    it("maps old freshness to critical severity", () => {
      const old: Freshness = {
        present: true,
        state: "old",
        updated: "2026-06-01",
        age_days: 68,
        mtime: "2026-06-01T05:15:20Z",
      };

      const tile = freshnessTile(old);

      expect(tile).toEqual({
        label: "Memory freshness",
        value: "68d",
        sub: "last written 2026-06-01",
        severity: "critical",
        action:
          "If you have been working in this repo since then, the stop hook is not firing.",
      });
    });

    it("uses 'last written' phrasing for old state", () => {
      const old: Freshness = {
        present: true,
        state: "old",
        updated: "2026-01-15",
        age_days: 205,
        mtime: "2026-01-15T09:30:00Z",
      };

      const tile = freshnessTile(old);

      expect(tile.sub).toContain("last written");
    });

    it("handles 31-day boundary in old state", () => {
      const old: Freshness = {
        present: true,
        state: "old",
        updated: "2026-07-08",
        age_days: 31,
        mtime: "2026-07-08T12:00:00Z",
      };

      const tile = freshnessTile(old);

      expect(tile.severity).toBe("critical");
      expect(tile.value).toBe("31d");
    });

    it("handles very old files", () => {
      const old: Freshness = {
        present: true,
        state: "old",
        updated: "2025-01-01",
        age_days: 585,
        mtime: "2025-01-01T00:00:00Z",
      };

      const tile = freshnessTile(old);

      expect(tile.severity).toBe("critical");
      expect(tile.value).toBe("585d");
    });
  });

  describe("label consistency", () => {
    it("always uses 'Memory freshness' as label", () => {
      const states: Freshness[] = [
        {
          present: false,
          state: "absent",
          updated: null,
          age_days: null,
          mtime: null,
        },
        {
          present: true,
          state: "good",
          updated: "2026-08-06",
          age_days: 2,
          mtime: "2026-08-06T10:00:00Z",
        },
        {
          present: true,
          state: "stale",
          updated: "2026-07-20",
          age_days: 19,
          mtime: "2026-07-20T08:00:00Z",
        },
        {
          present: true,
          state: "old",
          updated: "2026-06-01",
          age_days: 68,
          mtime: "2026-06-01T04:00:00Z",
        },
      ];

      states.forEach((state) => {
        const tile = freshnessTile(state);
        expect(tile.label).toBe("Memory freshness");
      });
    });
  });

  describe("date format in sub field", () => {
    it("includes exact date from updated field in sub", () => {
      const good: Freshness = {
        present: true,
        state: "good",
        updated: "2025-12-25",
        age_days: 226,
        mtime: "2025-12-25T00:00:00Z",
      };

      const tile = freshnessTile(good);

      expect(tile.sub).toContain("2025-12-25");
    });

    it("does not include time component, only YYYY-MM-DD", () => {
      const stale: Freshness = {
        present: true,
        state: "stale",
        updated: "2026-07-20",
        age_days: 19,
        mtime: "2026-07-20T08:45:30Z",
      };

      const tile = freshnessTile(stale);

      expect(tile.sub).toMatch(/2026-07-20/);
      expect(tile.sub).not.toContain("T");
      expect(tile.sub).not.toContain(":");
    });
  });

  describe("fixture compliance", () => {
    it("maps fixture absent to correct tile", () => {
      const absent: Freshness = {
        present: false,
        state: "absent",
        updated: null,
        age_days: null,
        mtime: null,
      };

      const tile = freshnessTile(absent);

      expect(tile).toEqual({
        label: "Memory freshness",
        value: "—",
        sub: "no state.yaml yet",
        severity: "neutral",
        action: "No session has ended in this repo yet.",
      });
    });

    it("maps fixture GOOD_STATE result to correct tile", () => {
      const good: Freshness = {
        present: true,
        state: "good",
        updated: "2026-08-06",
        age_days: 2,
        mtime: "2026-08-06T10:00:00Z",
      };

      const tile = freshnessTile(good);

      expect(tile).toEqual({
        label: "Memory freshness",
        value: "2d",
        sub: "updated 2026-08-06",
        severity: "good",
      });
    });

    it("maps fixture STALE_STATE result to correct tile", () => {
      const stale: Freshness = {
        present: true,
        state: "stale",
        updated: "2026-07-20",
        age_days: 19,
        mtime: "2026-07-20T08:00:00Z",
      };

      const tile = freshnessTile(stale);

      expect(tile).toEqual({
        label: "Memory freshness",
        value: "19d",
        sub: "last written 2026-07-20",
        severity: "warning",
        action:
          "Normal after a break. If you have been working here, the stop hook may not be firing.",
      });
    });

    it("maps fixture OLD_STATE result to correct tile", () => {
      const old: Freshness = {
        present: true,
        state: "old",
        updated: "2026-06-01",
        age_days: 68,
        mtime: "2026-06-01T04:00:00Z",
      };

      const tile = freshnessTile(old);

      expect(tile).toEqual({
        label: "Memory freshness",
        value: "68d",
        sub: "last written 2026-06-01",
        severity: "critical",
        action:
          "If you have been working in this repo since then, the stop hook is not firing.",
      });
    });
  });
});
