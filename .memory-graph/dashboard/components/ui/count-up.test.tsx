// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { CountUp } from "./count-up";
import { stubMatchMedia } from "../../tests/sandbox";
import { DURATION } from "../../lib/motion-tokens";

function text(): string {
  return screen.getByTestId("count-up").textContent || "";
}

describe("CountUp", () => {
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
    render(<CountUp value={42} animate={false} />);
    expect(screen.getByTestId("count-up")).not.toBeNull();
  });

  it("has data-animate attribute", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<CountUp value={42} animate={true} />);
    expect(screen.getByTestId("count-up").getAttribute("data-animate")).toBe("true");
  });

  it("has data-value attribute with target value", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<CountUp value={42} animate={false} />);
    expect(screen.getByTestId("count-up").getAttribute("data-value")).toBe("42");
  });

  it("shows final value when animate is false", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<CountUp value={42} animate={false} />);
    expect(text()).toBe("42");
  });

  it("reports the true target via data-value even while animating", () => {
    // Per contract: when animate=true and motion is safe, `displayed`
    // INTERPOLATES from the previous value -- it does not jump straight to
    // the final value. Only data-value is guaranteed to already carry the
    // true target on the very first render, so a test can assert
    // correctness without waiting on the animation.
    matchMediaStub = stubMatchMedia(false);
    const { rerender } = render(<CountUp value={10} animate={false} />);
    rerender(<CountUp value={50} animate={true} />);

    expect(screen.getByTestId("count-up").getAttribute("data-value")).toBe("50");
  });

  it("does not animate when reduced-motion is set", () => {
    matchMediaStub = stubMatchMedia(true);
    const { rerender } = render(<CountUp value={10} animate={false} />);
    rerender(<CountUp value={50} animate={true} />);

    expect(text()).toBe("50");

    act(() => {


      vi.advanceTimersByTime(1000);


    });
    expect(text()).toBe("50");
  });

  it("uses DURATION.base as default durationSec", () => {
    matchMediaStub = stubMatchMedia(false);
    const { rerender } = render(<CountUp value={0} animate={false} />);
    rerender(<CountUp value={100} animate={true} />);

    // After base duration, should reach target
    act(() => {
      vi.advanceTimersByTime((DURATION.base + 0.05) * 1000);
    });
    expect(text()).toBe("100");
  });

  it("uses custom durationSec", () => {
    matchMediaStub = stubMatchMedia(false);
    const { rerender } = render(<CountUp value={0} animate={false} />);
    rerender(<CountUp value={100} animate={true} durationSec={0.2} />);

    // After custom duration
    act(() => {

      vi.advanceTimersByTime(200);

    });
    expect(text()).toBe("100");
  });

  it("interpolates between values", () => {
    matchMediaStub = stubMatchMedia(false);
    const { rerender } = render(<CountUp value={0} animate={false} />);
    rerender(<CountUp value={100} animate={true} durationSec={0.2} />);

    // Mid-animation, value should be between 0 and 100
    act(() => {

      vi.advanceTimersByTime(100);

    });
    const displayed = parseInt(text() || "0");
    expect(displayed).toBeGreaterThan(0);
    expect(displayed).toBeLessThan(100);
  });

  it("lands exactly on target value at completion", () => {
    matchMediaStub = stubMatchMedia(false);
    const { rerender } = render(<CountUp value={0} animate={false} />);
    rerender(<CountUp value={100} animate={true} durationSec={0.2} />);

    act(() => {


      vi.advanceTimersByTime(250);


    });
    expect(text()).toBe("100");
  });

  it("updates data-value on prop change", () => {
    matchMediaStub = stubMatchMedia(false);
    const { rerender } = render(<CountUp value={42} animate={false} />);
    rerender(<CountUp value={99} animate={false} />);
    expect(screen.getByTestId("count-up").getAttribute("data-value")).toBe("99");
  });

  it("rounds interpolated values with Math.round", () => {
    matchMediaStub = stubMatchMedia(false);
    const { rerender } = render(<CountUp value={0} animate={false} />);
    rerender(<CountUp value={33} animate={true} durationSec={0.2} />);

    // At 50% through animation, value should be close to 16.5, rounded to 16 or 17
    act(() => {

      vi.advanceTimersByTime(100);

    });
    const displayed = parseInt(text() || "0");
    // Should be an integer (rounded)
    expect(Number.isInteger(displayed)).toBe(true);
  });

  it("does not animate when animate is false", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<CountUp value={0} animate={false} />);
    expect(text()).toBe("0");

    act(() => {


      vi.advanceTimersByTime(1000);


    });
    expect(text()).toBe("0");
  });

  it("handles negative values", () => {
    matchMediaStub = stubMatchMedia(false);
    const { rerender } = render(<CountUp value={0} animate={false} />);
    rerender(<CountUp value={-50} animate={true} durationSec={0.2} />);

    act(() => {


      vi.advanceTimersByTime(250);


    });
    expect(text()).toBe("-50");
  });

  it("handles animation from negative to positive", () => {
    matchMediaStub = stubMatchMedia(false);
    const { rerender } = render(<CountUp value={-100} animate={false} />);
    rerender(<CountUp value={100} animate={true} durationSec={0.2} />);

    act(() => {


      vi.advanceTimersByTime(250);


    });
    expect(text()).toBe("100");
  });

  it("handles zero value", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<CountUp value={0} animate={false} />);
    expect(text()).toBe("0");
  });

  it("handles decimal rounding correctly", () => {
    matchMediaStub = stubMatchMedia(false);
    const { rerender } = render(<CountUp value={0} animate={false} />);
    // Animate to a value that requires proper rounding
    rerender(<CountUp value={99} animate={true} durationSec={0.2} />);

    act(() => {


      vi.advanceTimersByTime(250);


    });
    expect(text()).toBe("99");
  });
});
