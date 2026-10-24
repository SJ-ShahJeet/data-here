import { describe, it, expect } from "vitest";
import { changedNumericPaths } from "./changed-keys";

describe("changedNumericPaths", () => {
  it("detects changed scalar", () => {
    expect(changedNumericPaths({ a: 1 }, { a: 2 })).toEqual(["a"]);
  });

  it("returns empty array when unchanged", () => {
    expect(changedNumericPaths({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it("detects nested object changes", () => {
    expect(changedNumericPaths({ a: { b: 1 } }, { a: { b: 9 } })).toEqual([
      "a.b",
    ]);
  });

  it("detects array element changes", () => {
    expect(
      changedNumericPaths(
        { x: [{ n: 1 }, { n: 2 }] },
        { x: [{ n: 1 }, { n: 5 }] }
      )
    ).toEqual(["x.1.n"]);
  });

  it("ignores new keys in next", () => {
    expect(changedNumericPaths({}, { a: 1 })).toEqual([]);
  });

  it("ignores type differences (non-numeric)", () => {
    expect(changedNumericPaths({ a: 1 }, { a: "1" })).toEqual([]);
  });

  it("returns sorted paths", () => {
    expect(changedNumericPaths({ b: 2, a: 1 }, { b: 3, a: 4 })).toEqual([
      "a",
      "b",
    ]);
  });

  it("stops descending when type differs", () => {
    expect(changedNumericPaths({ a: { b: 1 } }, { a: [1, 2] })).toEqual([]);
  });

  it("ignores NaN values", () => {
    expect(changedNumericPaths({ a: NaN }, { a: NaN })).toEqual([]);
    expect(changedNumericPaths({ a: 1 }, { a: NaN })).toEqual([]);
  });

  it("ignores Infinity values", () => {
    expect(changedNumericPaths({ a: Infinity }, { a: Infinity })).toEqual([]);
    expect(changedNumericPaths({ a: 1 }, { a: Infinity })).toEqual([]);
  });

  it("descends into arrays up to min length", () => {
    expect(
      changedNumericPaths(
        { x: [{ n: 1 }, { n: 2 }, { n: 3 }] },
        { x: [{ n: 10 }, { n: 20 }] }
      )
    ).toEqual(["x.0.n", "x.1.n"]);
  });

  it("descends into multiple keys", () => {
    expect(
      changedNumericPaths(
        { a: { b: 1, c: 2 }, d: 3 },
        { a: { b: 10, c: 2 }, d: 4 }
      )
    ).toEqual(["a.b", "d"]);
  });

  it("handles deep nesting", () => {
    expect(
      changedNumericPaths(
        { a: { b: { c: { d: 1 } } } },
        { a: { b: { c: { d: 2 } } } }
      )
    ).toEqual(["a.b.c.d"]);
  });

  it("returns empty array for deep-equal objects", () => {
    expect(
      changedNumericPaths(
        { a: { b: [1, 2, 3] }, c: 4 },
        { a: { b: [1, 2, 3] }, c: 4 }
      )
    ).toEqual([]);
  });

  it("handles mixed types correctly", () => {
    expect(
      changedNumericPaths(
        { a: 1, b: "text", c: { d: 2 } },
        { a: 10, b: "text", c: { d: 2 } }
      )
    ).toEqual(["a"]);
  });
});
