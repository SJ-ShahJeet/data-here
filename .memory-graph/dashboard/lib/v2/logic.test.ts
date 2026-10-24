import { describe, it, expect } from "vitest";
import {
  budgetTokens,
  decayDays,
  parseKinds,
  halvedCount,
  halvedNote,
  sessionMeta,
  budgetLabel,
  clampCursor,
  filterPalette,
  initialState,
  injectedCount,
  liveQueue,
  mergePlan,
  nextLabel,
  sameRect,
  setupHint,
  sparkHeights,
  toggleKey,
  tourCardPosition,
  visibleNodes,
} from "./logic";
import { SAMPLE } from "./sample";

describe("v2 logic", () => {
  describe("toggleKey", () => {
    it("adds a missing key and removes a present one without mutating", () => {
      const a = {};
      const b = toggleKey(a, "x");
      expect(b).toEqual({ x: true });
      expect(a).toEqual({});
      expect(toggleKey(b, "x")).toEqual({});
    });
  });

  describe("liveQueue / clampCursor", () => {
    it("drops resolved items and clamps the queueIndex to what is left", () => {
      const live = liveQueue(SAMPLE.queue, { q1: "confirmed" });
      expect(live.map((q) => q.id)).toEqual(["q2", "q3"]);
      expect(clampCursor(5, live.length)).toBe(1);
      expect(clampCursor(0, 0)).toBe(0);
    });
  });

  describe("visibleNodes", () => {
    it("applies status overrides, prunes and the filter", () => {
      const s = initialState();
      const all = visibleNodes(SAMPLE.nodes, s);
      expect(all).toHaveLength(SAMPLE.nodes.length);

      const unreviewed = visibleNodes(SAMPLE.nodes, { ...s, filter: "Unreviewed" });
      expect(unreviewed.every((n) => n.status === "unreviewed")).toBe(true);
      expect(unreviewed).toHaveLength(3);

      const eks = SAMPLE.nodes.find((n) => n.claim === "eks module pinned to 19.x")!;
      const pinned = visibleNodes(SAMPLE.nodes, {
        ...s,
        filter: "Unreviewed",
        nodeStatus: { [eks.id]: "pinned" },
      });
      expect(pinned).toHaveLength(2);

      const vpn = SAMPLE.nodes.find((n) => n.claim === "Applies must run from the ops VPN")!;
      const pruned = visibleNodes(SAMPLE.nodes, { ...s, filter: "Constraint", pruned: { [vpn.id]: true } });
      expect(pruned.map((n) => n.claim)).toEqual(["us-east-1 is the only region with NAT"]);
    });
  });

  describe("mergePlan", () => {
    it("needs two rows and keeps the heaviest", () => {
      expect(mergePlan(SAMPLE.nodes, { a: true })).toBeNull();
      const id = (claim: string) => SAMPLE.nodes.find((n) => n.claim === claim)!.id;
      const helm = id("Helm charts vendored, not pulled");
      const tf = id("Terraform state locks via DynamoDB");
      const bastion = id("Old bastion host runbook");
      const plan = mergePlan(SAMPLE.nodes, { [helm]: true, [tf]: true, [bastion]: true });
      expect(plan?.keep).toBe(tf);
      expect(plan?.fold).toEqual([helm, bastion]);
    });
  });

  describe("injection summary", () => {
    it("matches the design's estimate and never goes negative", () => {
      expect(injectedCount(318, 0, 30)).toBe(250);
      expect(injectedCount(318, 5, 100)).toBe(31);
      expect(injectedCount(318, 8, 0)).toBe(0);
      expect(budgetLabel("No cap")).toBe("7.9k");
      expect(budgetLabel("6k")).toBe("6k");
    });
  });

  describe("sparkHeights", () => {
    it("scales to 16px with a 2px floor", () => {
      expect(sparkHeights([1, 50, 100])).toEqual([2, 8, 16]);
    });
  });

  describe("filterPalette", () => {
    const entries = [
      { group: "Go" as const, label: "Overview", hint: "", run: () => {} },
      { group: "Set" as const, label: "Context budget 12k", hint: "", run: () => {} },
    ];
    it("matches on group and label, case-insensitively", () => {
      expect(filterPalette(entries, "")).toHaveLength(2);
      expect(filterPalette(entries, "BUDGET")).toHaveLength(1);
      expect(filterPalette(entries, "set ")).toHaveLength(1);
      expect(filterPalette(entries, "zzz")).toHaveLength(0);
    });
  });

  describe("tour geometry", () => {
    it("centres when there is no rect", () => {
      expect(tourCardPosition(null, 1200, 800)).toBeNull();
    });
    it("places the card below the ring when there is room, else above", () => {
      const below = tourCardPosition({ t: 100, l: 40, w: 300, h: 50 }, 1200, 800);
      expect(below).toEqual({ top: 168, left: 40, width: 360 });
      const above = tourCardPosition({ t: 700, l: 40, w: 300, h: 50 }, 1200, 800);
      expect(above?.top).toBe(464);
    });
    it("keeps the card inside the viewport", () => {
      const p = tourCardPosition({ t: 10, l: 1100, w: 80, h: 20 }, 1200, 800);
      expect(p?.left).toBe(1200 - 360 - 16);
      const narrow = tourCardPosition({ t: 10, l: 0, w: 80, h: 20 }, 320, 800);
      expect(narrow?.width).toBe(288);
      expect(narrow?.left).toBe(16);
    });
    it("treats sub-pixel movement as the same rect", () => {
      expect(sameRect({ t: 1, l: 1, w: 1, h: 1 }, { t: 1.4, l: 1, w: 1, h: 1 })).toBe(true);
      expect(sameRect({ t: 1, l: 1, w: 1, h: 1 }, { t: 3, l: 1, w: 1, h: 1 })).toBe(false);
      expect(sameRect(null, null)).toBe(true);
      expect(sameRect(null, { t: 0, l: 0, w: 0, h: 0 })).toBe(false);
    });
  });

  describe("setup copy", () => {
    it("labels the next button by step and scan state", () => {
      expect(nextLabel(0, false)).toBe("Skip to results");
      expect(nextLabel(0, true)).toBe("Continue");
      expect(nextLabel(3, true)).toBe("Finish setup");
    });
    it("hints per step", () => {
      expect(setupHint(0, false, 6, 12, 12)).toBe("reading the repository…");
      expect(setupHint(0, true, 6, 12, 12)).toBe("12 proposals ready");
      expect(setupHint(1, true, 5, 12, 12)).toBe("5 technologies in use");
      expect(setupHint(2, true, 5, 10, 12)).toBe("10 facts will enter the graph");
    });
  });
});

describe("sparkHeights edge cases", () => {
  it("returns an empty array for an empty input instead of NaN heights (scenario 15)", () => {
    expect(sparkHeights([])).toEqual([]);
  });

  it("still scales to 16px with a 2px floor for a non-empty input (scenario 15)", () => {
    expect(sparkHeights([1, 50, 100])).toEqual([2, 8, 16]);
  });
});

describe("sessionMeta and halvedNote", () => {
  const base = { id: "S-1", read: 3 } as const;
  it("adds 'ago' only to relative ages", () => {
    const data = { sessions: [{ ...base, when: "2h" }, { ...base, when: "2026-09-20" }] } as unknown as Parameters<typeof sessionMeta>[0];
    expect(sessionMeta(data, 0)).toBe("S-1 · 2h ago · 3 read");
    expect(sessionMeta(data, 1)).toBe("S-1 · 2026-09-20 · 3 read");
  });
  it("counts nodes that fell below half their window-start weight", () => {
    const w = (now: number, then: number) => ({ label: "x", kind: "Decision" as const, now, then });
    expect(halvedCount([w(0.2, 0.5), w(0.3, 0.5), w(0.5, 0)])).toBe(1);
    expect(halvedNote([])).toMatch(/No weighted nodes yet/);
    expect(halvedNote([w(0.5, 0.5)])).toMatch(/No node lost/);
    expect(halvedNote([w(0.1, 0.5)])).toBe("One node lost more than half its weight this window.");
    expect(halvedNote([w(0.1, 0.5), w(0.1, 0.5)])).toBe("2 nodes lost more than half their weight this window.");
  });
});

describe("injection settings helpers", () => {
  it("parses inject_kinds case-insensitively into canonical order, falling back to all", () => {
    expect(parseKinds("constraint, Decision")).toEqual(["Decision", "Constraint"]);
    expect(parseKinds("")).toEqual(["Decision", "Constraint", "Open thread", "Dependency", "Test/CI fact"]);
    expect(parseKinds("foo,bar")).toHaveLength(5);
    expect(parseKinds("test/ci fact")).toEqual(["Test/CI fact"]);
  });
  it("maps the budget and decay pills to the strings the config route accepts", () => {
    expect(budgetTokens("2k")).toBe("2000");
    expect(budgetTokens("No cap")).toBe("1000000");
    expect(decayDays("Off")).toBe("0");
    expect(decayDays("7 days")).toBe("7");
  });
  it("seeds the settings state from data.inject", () => {
    const s = initialState({ budget: "12k", kinds: ["Decision"], minWeight: 55, decay: "7 days", injectedCount: 3 });
    expect(s.budget).toBe("12k");
    expect(s.minWeight).toBe(55);
    expect(s.decay).toBe("7 days");
    expect(Object.keys(s.kindsOff).sort()).toEqual(["Constraint", "Dependency", "Open thread", "Test/CI fact"]);
    expect(initialState().kindsOff).toEqual({});
  });
});
