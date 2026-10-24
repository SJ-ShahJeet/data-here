export const EASE_HOUSE: readonly [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_HOUSE_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";
export const DURATION = {
  instant: 0.12,
  quick: 0.24,
  base: 1.2,
  slow: 1.2,
} as const;
export const STAGGER = {
  tile: 0.06,
  row: 0.03,
} as const;
export const SHIMMER_RUNS = 1;
export const DIM_OPACITY = 0.35;
export type DurationToken = keyof typeof DURATION;
export type StaggerToken = keyof typeof STAGGER;
