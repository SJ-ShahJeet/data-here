// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { GradientShimmer } from "./gradient-shimmer";
import { stubMatchMedia } from "../../tests/sandbox";
import { DURATION, SHIMMER_RUNS } from "../../lib/motion-tokens";

// NOTE: this file mixes vi.useFakeTimers() with React state that settles via
// effects. Testing Library's `render` already wraps mount in `act()`, which
// flushes chained effects (useMotionSafe's effect -> GradientShimmer's own
// effect) to a fixed point synchronously, so the "shimmering" state is
// already observable right after `render()` returns — no `waitFor` needed.
// `waitFor` polls with real timers internally, which never fire once fake
// timers are installed, so mixing the two hangs until the real 5s test
// timeout. Timer advances are wrapped in `act()` instead, which flushes the
// resulting state update synchronously too.
function shimmering(): string | null {
  return screen.getByTestId("gradient-shimmer").getAttribute("data-shimmering");
}

function runsRemaining(): string | null {
  return screen.getByTestId("gradient-shimmer").getAttribute("data-runs-remaining");
}

describe("GradientShimmer", () => {
  let matchMediaStub: ReturnType<typeof stubMatchMedia>;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    if (matchMediaStub) {
      matchMediaStub.restore();
    }
    vi.useRealTimers();
  });

  it("renders span with testid", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GradientShimmer>Test</GradientShimmer>);
    expect(screen.getByTestId("gradient-shimmer")).not.toBeNull();
  });

  it("starts with data-shimmering=false and data-runs-remaining=0", () => {
    matchMediaStub = stubMatchMedia(true);
    render(<GradientShimmer>Test</GradientShimmer>);
    expect(shimmering()).toBe("false");
    expect(runsRemaining()).toBe("0");
  });

  it("animates when motion is safe and runs > 0", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GradientShimmer runs={1}>Test</GradientShimmer>);
    expect(shimmering()).toBe("true");
  });

  it("settles to false after duration", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GradientShimmer runs={1}>Test</GradientShimmer>);
    expect(shimmering()).toBe("true");

    act(() => {
      vi.advanceTimersByTime((DURATION.slow + 0.1) * 1000);
    });

    expect(shimmering()).toBe("false");
    expect(runsRemaining()).toBe("0");
  });

  it("uses DURATION.slow as default durationSec", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GradientShimmer runs={1}>Test</GradientShimmer>);
    expect(shimmering()).toBe("true");

    // Advance by slightly less than DURATION.slow
    act(() => {
      vi.advanceTimersByTime((DURATION.slow - 0.1) * 1000);
    });
    expect(shimmering()).toBe("true");

    // Advance to complete
    act(() => {
      vi.advanceTimersByTime(0.2 * 1000);
    });
    expect(shimmering()).toBe("false");
  });

  it("uses SHIMMER_RUNS as default runs", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GradientShimmer>Test</GradientShimmer>);
    expect(runsRemaining()).toBe(String(SHIMMER_RUNS));
  });

  it("never shimmers with runs=0", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GradientShimmer runs={0}>Test</GradientShimmer>);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(shimmering()).toBe("false");
    expect(runsRemaining()).toBe("0");
  });

  it("shimmers exactly twice with runs=2", () => {
    matchMediaStub = stubMatchMedia(false);
    render(
      <GradientShimmer runs={2} durationSec={0.1}>
        Test
      </GradientShimmer>
    );

    // First run
    expect(shimmering()).toBe("true");

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(runsRemaining()).toBe("1");

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(shimmering()).toBe("false");
    expect(runsRemaining()).toBe("0");
  });

  it("never shimmers when reduced-motion is set", () => {
    matchMediaStub = stubMatchMedia(true);
    render(<GradientShimmer runs={1}>Test</GradientShimmer>);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(shimmering()).toBe("false");
    expect(runsRemaining()).toBe("0");
  });

  it("supports runs=Infinity", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GradientShimmer runs={Infinity}>Test</GradientShimmer>);
    expect(shimmering()).toBe("true");

    act(() => {
      vi.advanceTimersByTime((DURATION.slow + 0.1) * 1000);
    });

    // Should still be shimmering and remaining should be Infinity
    expect(runsRemaining()).toBe("Infinity");
  });

  it("applies className prop", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GradientShimmer className="custom-class">Test</GradientShimmer>);
    expect(screen.getByTestId("gradient-shimmer").classList.contains("custom-class")).toBe(true);
  });

  it("renders children", () => {
    matchMediaStub = stubMatchMedia(false);
    render(
      <GradientShimmer>
        <h1>Test Content</h1>
      </GradientShimmer>
    );
    expect(screen.getByText("Test Content")).not.toBeNull();
  });

  it("clears timeout on unmount", () => {
    matchMediaStub = stubMatchMedia(false);
    const { unmount } = render(
      <GradientShimmer runs={1} durationSec={1}>
        Test
      </GradientShimmer>
    );

    expect(shimmering()).toBe("true");

    unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // No crash or error should occur
  });

  it("uses custom durationSec", () => {
    matchMediaStub = stubMatchMedia(false);
    render(
      <GradientShimmer runs={1} durationSec={0.2}>
        Test
      </GradientShimmer>
    );

    expect(shimmering()).toBe("true");

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(shimmering()).toBe("true");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(shimmering()).toBe("false");
  });
});
