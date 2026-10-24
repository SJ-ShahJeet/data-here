import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { debounce } from "./debounce";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires exactly once for multiple calls within the window", () => {
    const fn = vi.fn();
    const db = debounce(fn, 100);

    db();
    db();
    db();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("fires ms after the LAST call, not the first", () => {
    const fn = vi.fn();
    const db = debounce(fn, 100);

    db();
    vi.advanceTimersByTime(50);
    db();
    vi.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("cancel() suppresses a pending call", () => {
    const fn = vi.fn();
    const db = debounce(fn, 100);

    db();
    vi.advanceTimersByTime(50);
    db.cancel();
    vi.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel() is idempotent", () => {
    const fn = vi.fn();
    const db = debounce(fn, 100);

    db();
    db.cancel();
    db.cancel();
    vi.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });

  it("can be called again after cancel()", () => {
    const fn = vi.fn();
    const db = debounce(fn, 100);

    db();
    db.cancel();
    db();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("trailing edge: fires after the last call", () => {
    const fn = vi.fn();
    const db = debounce(fn, 100);

    db();
    vi.advanceTimersByTime(50);
    db();
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledOnce();
  });
});
