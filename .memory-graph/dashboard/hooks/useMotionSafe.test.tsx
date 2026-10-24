// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, renderHook, waitFor } from "@testing-library/react";
import { useMotionSafe } from "./useMotionSafe";
import { stubMatchMedia } from "../tests/sandbox";

describe("useMotionSafe", () => {
  let matchMediaStub: ReturnType<typeof stubMatchMedia>;

  afterEach(() => {
    if (matchMediaStub) {
      matchMediaStub.restore();
    }
  });

  it("returns false on initial render", () => {
    // renderHook (and render) auto-flush passive effects via act() before
    // control returns to the test, so result.current/seen-after-render can
    // only ever observe the SETTLED value, never the pre-effect frame.
    // The contract's "initial state is FALSE deliberately" clause is about
    // that pre-effect frame, so we capture it during the render phase
    // itself, before useMotionSafe's effect has a chance to run.
    matchMediaStub = stubMatchMedia(false);
    const seen: boolean[] = [];
    function Probe() {
      seen.push(useMotionSafe());
      return null;
    }
    render(<Probe />);
    expect(seen[0]).toBe(false);
  });

  it("returns true after effect when reduced-motion is not set", async () => {
    matchMediaStub = stubMatchMedia(false);
    const { result } = renderHook(() => useMotionSafe());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("returns false when user has reduced-motion set", async () => {
    matchMediaStub = stubMatchMedia(true);
    const { result } = renderHook(() => useMotionSafe());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("queries matchMedia with exact string", async () => {
    matchMediaStub = stubMatchMedia(false);
    renderHook(() => useMotionSafe());

    await waitFor(() => {
      expect(matchMediaStub.calls).toContain("(prefers-reduced-motion: reduce)");
    });
  });

  it("returns plain boolean, not object", () => {
    matchMediaStub = stubMatchMedia(false);
    const { result } = renderHook(() => useMotionSafe());
    expect(typeof result.current).toBe("boolean");
  });

  it("returns false initially even when matchMedia reports reduced motion", () => {
    matchMediaStub = stubMatchMedia(true);
    const { result } = renderHook(() => useMotionSafe());
    expect(result.current).toBe(false);
  });

  it("updates when matchMedia reports change", async () => {
    matchMediaStub = stubMatchMedia(false);
    const { result } = renderHook(() => useMotionSafe());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});
