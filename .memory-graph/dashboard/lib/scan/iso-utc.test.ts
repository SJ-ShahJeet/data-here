import { describe, it, expect } from "vitest";
import { isoUtc } from "@/lib/scan/iso-utc";

describe("isoUtc", () => {
  it("converts epoch 0 to 1970-01-01T00:00:00Z", () => {
    const result = isoUtc(0);
    expect(result).toBe("1970-01-01T00:00:00Z");
  });

  it("converts 1786276800000 to 2026-08-09T12:00:00Z", () => {
    const result = isoUtc(1786276800000);
    expect(result).toBe("2026-08-09T12:00:00Z");
  });

  it("returns 20-character string in YYYY-MM-DDTHH:MM:SSZ format", () => {
    const result = isoUtc(Date.now());
    expect(result).toHaveLength(20);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("strips milliseconds from ISO string", () => {
    const result = isoUtc(1000);
    expect(result).not.toContain(".");
    expect(result).toMatch(/Z$/);
  });

  it("handles dates in the middle of the century", () => {
    const jun2020 = new Date("2020-06-15T14:30:45.123Z").getTime();
    const result = isoUtc(jun2020);
    expect(result).toBe("2020-06-15T14:30:45Z");
  });

  it("handles far future dates", () => {
    const year2100 = new Date("2100-12-31T23:59:59.999Z").getTime();
    const result = isoUtc(year2100);
    expect(result).toBe("2100-12-31T23:59:59Z");
  });
});
