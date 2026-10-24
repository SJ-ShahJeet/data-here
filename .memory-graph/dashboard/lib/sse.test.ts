import { describe, it, expect } from "vitest";
import { sseFrame } from "./sse";

describe("sseFrame", () => {
  it("formats state event with object data", () => {
    const result = sseFrame("state", { a: 1 });
    expect(result).toBe('event: state\ndata: {"a":1}\n\n');
  });

  it("formats ping event with null data", () => {
    const result = sseFrame("ping", null);
    expect(result).toBe('event: ping\ndata: null\n\n');
  });

  it("includes one trailing blank line", () => {
    const result = sseFrame("test", {});
    expect(result.endsWith("\n\n")).toBe(true);
    expect(result.endsWith("\n\n\n")).toBe(false);
  });

  it("has no id or retry fields", () => {
    const result = sseFrame("event", { x: 1 });
    expect(result).not.toContain("id:");
    expect(result).not.toContain("retry:");
  });

  it("has no leading whitespace", () => {
    const result = sseFrame("event", { x: 1 });
    expect(result.startsWith("event:")).toBe(true);
  });

  it("formats complex nested data correctly", () => {
    const result = sseFrame("update", { nested: { a: 1, b: 2 }, list: [1, 2] });
    expect(result).toBe(
      'event: update\ndata: {"nested":{"a":1,"b":2},"list":[1,2]}\n\n'
    );
  });
});
