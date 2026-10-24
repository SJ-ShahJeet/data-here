// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SavingsOverTime } from "./SavingsOverTime";
import { SessionCadence } from "./SessionCadence";
import { Sparkline } from "./Sparkline";
import { COMPRESSION_LEDGER, SESSION_FIXTURE, stubMatchMedia } from "../../tests/sandbox";

describe("SavingsOverTime", () => {
  let matchMediaStub: ReturnType<typeof stubMatchMedia>;

  afterEach(() => {
    cleanup();
    if (matchMediaStub) {
      matchMediaStub.restore();
    }
  });

  it("renders empty message when no compression events", () => {
    matchMediaStub = stubMatchMedia(false);
    render(
      <SavingsOverTime
        data={{
          present: false,
          entries: [],
          total_before: 0,
          total_after: 0,
          total_saved: 0,
        }}
      />
    );
    expect(screen.getByTestId("chart-empty").textContent).toContain("No compression events yet");
  });

  it("does not render svg when empty", () => {
    matchMediaStub = stubMatchMedia(false);
    render(
      <SavingsOverTime
        data={{
          present: false,
          entries: [],
          total_before: 0,
          total_after: 0,
          total_saved: 0,
        }}
      />
    );
    expect(screen.queryByTestId("chart-savings")).toBeNull();
  });

  it("renders svg with chart-savings testid", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SavingsOverTime data={COMPRESSION_LEDGER} />);
    expect(screen.getByTestId("chart-savings")).not.toBeNull();
  });

  it("renders path with chart-line testid", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SavingsOverTime data={COMPRESSION_LEDGER} />);
    expect(screen.getByTestId("chart-line")).not.toBeNull();
  });

  it("renders circle for each point", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SavingsOverTime data={COMPRESSION_LEDGER} />);
    const circles = screen.getAllByTestId("chart-point");
    expect(circles.length).toBe(COMPRESSION_LEDGER.entries.length);
  });

  it("sets data-index on circles", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SavingsOverTime data={COMPRESSION_LEDGER} />);
    const circles = screen.getAllByTestId("chart-point");
    circles.forEach((circle, i) => {
      expect(circle.getAttribute("data-index")).toBe(String(i));
    });
  });

  it("renders with default width and height", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SavingsOverTime data={COMPRESSION_LEDGER} />);
    const svg = screen.getByTestId("chart-savings");
    expect(svg.getAttribute("viewBox")).toBe("0 0 640 200");
  });

  it("renders with custom width and height", () => {
    matchMediaStub = stubMatchMedia(false);
    render(
      <SavingsOverTime data={COMPRESSION_LEDGER} width={800} height={300} />
    );
    const svg = screen.getByTestId("chart-savings");
    expect(svg.getAttribute("viewBox")).toBe("0 0 800 300");
  });

  it("uses chart-2 stroke color", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SavingsOverTime data={COMPRESSION_LEDGER} />);
    const path = screen.getByTestId("chart-line");
    expect(path.getAttribute("stroke")).toBe("var(--chart-2)");
  });

  it("renders scrub card", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SavingsOverTime data={COMPRESSION_LEDGER} />);
    expect(screen.getByTestId("chart-scrub")).not.toBeNull();
  });

  it("shows scrub on hover", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SavingsOverTime data={COMPRESSION_LEDGER} />);
    const scrub = screen.getByTestId("chart-scrub");
    const circle = screen.getAllByTestId("chart-point")[0];

    expect(scrub.getAttribute("data-visible")).toBe("false");
    fireEvent.mouseEnter(circle);
    expect(scrub.getAttribute("data-visible")).toBe("true");
  });

  it("updates scrub index on hover", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SavingsOverTime data={COMPRESSION_LEDGER} />);
    const scrub = screen.getByTestId("chart-scrub");
    const circles = screen.getAllByTestId("chart-point");

    fireEvent.mouseEnter(circles[1]);
    expect(scrub.getAttribute("data-index")).toBe("1");
  });

  it("hides scrub on mouse leave", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SavingsOverTime data={COMPRESSION_LEDGER} />);
    const scrub = screen.getByTestId("chart-scrub");
    const circle = screen.getAllByTestId("chart-point")[0];

    fireEvent.mouseEnter(circle);
    expect(scrub.getAttribute("data-visible")).toBe("true");

    fireEvent.mouseLeave(circle);
    expect(scrub.getAttribute("data-visible")).toBe("false");
  });

  it("dims non-hovered points", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SavingsOverTime data={COMPRESSION_LEDGER} />);
    const circles = screen.getAllByTestId("chart-point");

    fireEvent.mouseEnter(circles[0]);

    expect(circles[0].getAttribute("data-dimmed")).toBe("false");
    expect(circles[1].getAttribute("data-dimmed")).toBe("true");
  });

  it("resets dimming on mouse leave", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SavingsOverTime data={COMPRESSION_LEDGER} />);
    const circles = screen.getAllByTestId("chart-point");

    fireEvent.mouseEnter(circles[0]);
    fireEvent.mouseLeave(circles[0]);

    circles.forEach((circle) => {
      expect(circle.getAttribute("data-dimmed")).toBe("false");
    });
  });
});

describe("SessionCadence", () => {
  let matchMediaStub: ReturnType<typeof stubMatchMedia>;

  afterEach(() => {
    cleanup();
    if (matchMediaStub) {
      matchMediaStub.restore();
    }
  });

  it("renders empty message when no sessions", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SessionCadence data={{ present: false, count: 0, items: [] }} />);
    expect(screen.getByTestId("chart-empty").textContent).toContain("No sessions recorded yet");
  });

  it("does not render svg when empty", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SessionCadence data={{ present: false, count: 0, items: [] }} />);
    expect(screen.queryByTestId("chart-cadence")).toBeNull();
  });

  it("renders svg with chart-cadence testid", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SessionCadence data={SESSION_FIXTURE} />);
    expect(screen.getByTestId("chart-cadence")).not.toBeNull();
  });

  it("uses chart-4 stroke color", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SessionCadence data={SESSION_FIXTURE} />);
    const path = screen.getByTestId("chart-line");
    expect(path.getAttribute("stroke")).toBe("var(--chart-4)");
  });

  it("renders with default dimensions", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SessionCadence data={SESSION_FIXTURE} />);
    const svg = screen.getByTestId("chart-cadence");
    expect(svg.getAttribute("viewBox")).toBe("0 0 640 200");
  });

  it("renders with custom dimensions", () => {
    matchMediaStub = stubMatchMedia(false);
    render(
      <SessionCadence data={SESSION_FIXTURE} width={500} height={250} />
    );
    const svg = screen.getByTestId("chart-cadence");
    expect(svg.getAttribute("viewBox")).toBe("0 0 500 250");
  });

  it("renders scrub card", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SessionCadence data={SESSION_FIXTURE} />);
    expect(screen.getByTestId("chart-scrub")).not.toBeNull();
  });

  it("aria-label is descriptive", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<SessionCadence data={SESSION_FIXTURE} />);
    const svg = screen.getByTestId("chart-cadence");
    expect(svg.getAttribute("aria-label")).toBe("Sessions per day");
  });
});

describe("Sparkline", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders svg with sparkline testid", () => {
    render(<Sparkline values={[1, 2, 3, 4, 5]} />);
    expect(screen.getByTestId("sparkline")).not.toBeNull();
  });

  it("sets data-empty=true when less than 2 values", () => {
    render(<Sparkline values={[1]} />);
    expect(screen.getByTestId("sparkline").getAttribute("data-empty")).toBe("true");
  });

  it("sets data-empty=false when 2+ values", () => {
    render(<Sparkline values={[1, 2]} />);
    expect(screen.getByTestId("sparkline").getAttribute("data-empty")).toBe("false");
  });

  it("does not render path when data-empty=true", () => {
    render(<Sparkline values={[1]} />);
    expect(screen.queryByTestId("sparkline-path")).toBeNull();
  });

  it("renders path when data-empty=false", () => {
    render(<Sparkline values={[1, 2]} />);
    expect(screen.getByTestId("sparkline-path")).not.toBeNull();
  });

  it("uses default width of 72", () => {
    render(<Sparkline values={[1, 2]} />);
    const svg = screen.getByTestId("sparkline");
    expect(svg.getAttribute("viewBox")).toBe("0 0 72 20");
  });

  it("uses default height of 20", () => {
    render(<Sparkline values={[1, 2]} />);
    const svg = screen.getByTestId("sparkline");
    expect(svg.getAttribute("viewBox")).toBe("0 0 72 20");
  });

  it("uses custom width and height", () => {
    render(<Sparkline values={[1, 2]} width={100} height={30} />);
    const svg = screen.getByTestId("sparkline");
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 30");
  });

  it("uses chart-3 stroke color", () => {
    render(<Sparkline values={[1, 2]} />);
    const path = screen.getByTestId("sparkline-path");
    expect(path.getAttribute("stroke")).toBe("var(--chart-3)");
  });

  it("has aria-hidden=true", () => {
    render(<Sparkline values={[1, 2]} />);
    const svg = screen.getByTestId("sparkline");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("handles empty array", () => {
    render(<Sparkline values={[]} />);
    expect(screen.getByTestId("sparkline").getAttribute("data-empty")).toBe("true");
  });

  it("handles many values", () => {
    const values = Array.from({ length: 100 }, (_, i) => i);
    render(<Sparkline values={values} />);
    expect(screen.getByTestId("sparkline").getAttribute("data-empty")).toBe("false");
  });
});
