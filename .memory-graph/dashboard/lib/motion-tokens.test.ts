import { describe, it, expect } from "vitest";
import {
  EASE_HOUSE,
  EASE_HOUSE_CSS,
  DURATION,
  STAGGER,
  SHIMMER_RUNS,
  DIM_OPACITY,
} from "./motion-tokens";

describe("motion-tokens", () => {
  it("EASE_HOUSE deep-equals [0.16, 1, 0.3, 1]", () => {
    expect(EASE_HOUSE).toEqual([0.16, 1, 0.3, 1]);
  });

  it("EASE_HOUSE_CSS === 'cubic-bezier(0.16, 1, 0.3, 1)'", () => {
    expect(EASE_HOUSE_CSS).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
  });

  it("DURATION deep-equals { instant: 0.12, quick: 0.24, base: 1.2, slow: 1.2 }", () => {
    expect(DURATION).toEqual({
      instant: 0.12,
      quick: 0.24,
      base: 1.2,
      slow: 1.2,
    });
  });

  it("STAGGER deep-equals { tile: 0.06, row: 0.03 }", () => {
    expect(STAGGER).toEqual({
      tile: 0.06,
      row: 0.03,
    });
  });

  it("SHIMMER_RUNS === 1", () => {
    expect(SHIMMER_RUNS).toBe(1);
  });

  it("DIM_OPACITY === 0.35", () => {
    expect(DIM_OPACITY).toBe(0.35);
  });
});
