import { describe, it, expect } from "vitest";
import { savingsSeries, cadenceSeries, linePath, Point } from "./series";
import type { SessionItem } from "@/lib/scan/sessions";

function sessionItem(id: string, date: string): SessionItem {
  return {
    file: `sessions/${id}.md`,
    date,
    time: "",
    session: null,
    topics: "",
    context: "",
    scope: [],
    god_nodes_touched: [],
    open: [],
    blocked: [],
  };
}

describe("savingsSeries", () => {
  it("returns empty array for empty entries", () => {
    const result = savingsSeries({
      present: false,
      entries: [],
      total_before: 0,
      total_after: 0,
      total_saved: 0,
    });
    expect(result).toEqual([]);
  });

  it("computes running cumulative total of saved", () => {
    const result = savingsSeries({
      present: true,
      entries: [
        { at: "2026-08-05T00:00:00Z", tool: "compress", before: 8000, after: 200, saved: 7800 },
        { at: "2026-08-06T00:00:00Z", tool: "compress", before: 6200, after: 100, saved: 6100 },
        { at: "2026-08-07T00:00:00Z", tool: "compress", before: 100, after: 100, saved: 0 },
      ],
      total_before: 10000,
      total_after: -3900,
      total_saved: 13900,
    });
    expect(result).toEqual([
      { x: 0, y: 7800 },
      { x: 1, y: 13900 },
      { x: 2, y: 13900 },
    ]);
  });

  it("uses index as x coordinate", () => {
    const result = savingsSeries({
      present: true,
      entries: [
        { at: "2026-08-05T00:00:00Z", tool: "compress", before: 101, after: 1, saved: 100 },
        { at: "2026-08-06T00:00:00Z", tool: "compress", before: 202, after: 2, saved: 200 },
      ],
      total_before: 0,
      total_after: 0,
      total_saved: 300,
    });
    expect(result.map((p) => p.x)).toEqual([0, 1]);
  });
});

describe("cadenceSeries", () => {
  it("returns empty array when no items", () => {
    expect(cadenceSeries({ present: false, count: 0, items: [] })).toEqual([]);
  });

  it("counts sessions per calendar date sorted ascending", () => {
    const result = cadenceSeries({
      present: true,
      count: 3,
      items: [
        sessionItem("s1", "2026-08-07"),
        sessionItem("s2", "2026-08-07"),
        sessionItem("s3", "2026-08-05"),
      ],
    });
    expect(result).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 2 },
    ]);
  });

  it("excludes items with empty string date", () => {
    const result = cadenceSeries({
      present: true,
      count: 2,
      items: [sessionItem("s1", ""), sessionItem("s2", "2026-08-05")],
    });
    expect(result).toEqual([{ x: 0, y: 1 }]);
  });

  it("sorts dates ascending by code point", () => {
    const result = cadenceSeries({
      present: true,
      count: 3,
      items: [
        sessionItem("s1", "2026-08-10"),
        sessionItem("s2", "2026-08-05"),
        sessionItem("s3", "2026-08-15"),
      ],
    });
    expect(result.map((p) => p.x)).toEqual([0, 1, 2]);
  });

  it("uses index as x coordinate", () => {
    const result = cadenceSeries({
      present: true,
      count: 2,
      items: [sessionItem("s1", "2026-08-05"), sessionItem("s2", "2026-08-06")],
    });
    expect(result.map((p) => p.x)).toEqual([0, 1]);
  });
});

describe("linePath", () => {
  it("returns empty string for empty points", () => {
    expect(linePath([], 100, 50)).toBe("");
  });

  it("returns move command for single point", () => {
    expect(linePath([{ x: 0, y: 5 }], 100, 50)).toBe("M 50 25");
  });

  it("computes two-point line correctly", () => {
    expect(linePath([{ x: 0, y: 0 }, { x: 1, y: 10 }], 100, 50)).toBe(
      "M 8 42 L 92 8"
    );
  });

  it("handles flat line (all same y)", () => {
    expect(
      linePath(
        [
          { x: 0, y: 5 },
          { x: 1, y: 5 },
          { x: 2, y: 5 },
        ],
        100,
        50
      )
    ).toBe("M 8 25 L 50 25 L 92 25");
  });

  it("respects zero padding", () => {
    expect(linePath([{ x: 0, y: 0 }, { x: 1, y: 1 }], 100, 50, 0)).toBe(
      "M 0 50 L 100 0"
    );
  });

  it("defaults padding to 8", () => {
    const result = linePath([{ x: 0, y: 0 }, { x: 1, y: 1 }], 100, 50);
    expect(result).toBe("M 8 42 L 92 8");
  });

  it("flips y coordinates", () => {
    const result = linePath([{ x: 0, y: 0 }, { x: 1, y: 1 }], 100, 50);
    const coords = result.match(/\d+(?:\.\d+)?/g);
    // First y should be higher than second y for inverted data
    expect(Number(coords![1]) > Number(coords![3])).toBe(true);
  });

  it("rounds coordinates with toFixed(2)", () => {
    const result = linePath(
      [
        { x: 0, y: 0 },
        { x: 1, y: 10 },
      ],
      100,
      50
    );
    // All coordinates should not have more than 2 decimal places
    const coords = result.match(/\d+(?:\.\d+)?/g);
    coords?.forEach((c) => {
      const decimal = c.split(".")[1];
      if (decimal) {
        expect(decimal.length).toBeLessThanOrEqual(2);
      }
    });
  });

  it("handles line with zero x range", () => {
    const result = linePath(
      [
        { x: 5, y: 0 },
        { x: 5, y: 10 },
      ],
      100,
      50
    );
    const coords = result.match(/\d+(?:\.\d+)?/g);
    // Both x values should be the same (width / 2)
    expect(coords![0]).toBe(coords![2]);
  });

  it("handles line with zero y range", () => {
    const result = linePath(
      [
        { x: 0, y: 5 },
        { x: 1, y: 5 },
      ],
      100,
      50
    );
    const coords = result.match(/\d+(?:\.\d+)?/g);
    // Both y values should be the same (height / 2)
    expect(coords![1]).toBe(coords![3]);
  });

  it("uses single space separator, no commas", () => {
    const result = linePath([{ x: 0, y: 0 }, { x: 1, y: 1 }], 100, 50);
    expect(result).not.toContain(",");
    expect(result.includes(" ")).toBe(true);
  });

  it("formats as M x0 y0 L x1 y1 L x2 y2", () => {
    const result = linePath(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
      100,
      50
    );
    expect(result.startsWith("M")).toBe(true);
    expect(result.includes(" L ")).toBe(true);
  });

  it("handles three-point line", () => {
    const result = linePath(
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
      ],
      100,
      50
    );
    const parts = result.split(" ");
    expect(parts[0]).toBe("M");
    expect(parts[3]).toBe("L");
    expect(parts[6]).toBe("L");
  });
});
