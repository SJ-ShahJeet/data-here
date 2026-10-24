// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Card, severityBoxShadow, CardSeverity } from "./card";

afterEach(() => {
  cleanup();
});

describe("severityBoxShadow", () => {
  it('returns correct shadow for "good"', () => {
    expect(severityBoxShadow("good")).toBe("inset 0 0 0 1px var(--severity-good)");
  });

  it('returns correct shadow for "warning"', () => {
    expect(severityBoxShadow("warning")).toBe("inset 0 0 0 1px var(--severity-warn)");
  });

  it('returns correct shadow for "critical"', () => {
    expect(severityBoxShadow("critical")).toBe("inset 0 0 0 1px var(--severity-bad)");
  });

  it('returns correct shadow for "neutral"', () => {
    expect(severityBoxShadow("neutral")).toBe("inset 0 0 0 1px var(--severity-idle)");
  });

  it("falls back to neutral for unknown severity", () => {
    expect(severityBoxShadow("unknown" as CardSeverity)).toBe("inset 0 0 0 1px var(--severity-idle)");
  });

  it("returns pure string with no side effects", () => {
    const result = severityBoxShadow("good");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^inset/);
  });
});

describe("Card", () => {
  it("renders div with testid", () => {
    render(<Card />);
    expect(screen.getByTestId("card")).not.toBeNull();
  });

  it("has data-severity attribute", () => {
    render(<Card severity="good" />);
    expect(screen.getByTestId("card").getAttribute("data-severity")).toBe("good");
  });

  it("defaults severity to neutral", () => {
    render(<Card />);
    expect(screen.getByTestId("card").getAttribute("data-severity")).toBe("neutral");
  });

  it("applies correct boxShadow for severity", () => {
    const { rerender } = render(<Card severity="good" />);
    expect((screen.getByTestId("card") as HTMLElement).style.boxShadow).toBe(
      "inset 0 0 0 1px var(--severity-good)"
    );

    rerender(<Card severity="critical" />);
    expect((screen.getByTestId("card") as HTMLElement).style.boxShadow).toBe(
      "inset 0 0 0 1px var(--severity-bad)"
    );
  });

  it("renders children", () => {
    render(<Card>Child content</Card>);
    expect(screen.getByText("Child content")).not.toBeNull();
  });

  it("passes through HTML attributes", () => {
    render(
      <Card data-custom="value" className="test-class" id="card-id">
        Content
      </Card>
    );
    const card = screen.getByTestId("card");
    expect(card.getAttribute("data-custom")).toBe("value");
    expect(card.classList.contains("test-class")).toBe(true);
    expect(card.getAttribute("id")).toBe("card-id");
  });

  it("merges style prop with boxShadow", () => {
    render(
      <Card severity="warning" style={{ padding: "10px" }}>
        Content
      </Card>
    );
    const card = screen.getByTestId("card") as HTMLElement;
    expect(card.style.boxShadow).toBe("inset 0 0 0 1px var(--severity-warn)");
    expect(card.style.padding).toBe("10px");
  });

  it("applies correct data-severity for all severities", () => {
    const severities: CardSeverity[] = ["good", "warning", "critical", "neutral"];

    severities.forEach((severity) => {
      const { unmount } = render(<Card severity={severity} />);
      expect(screen.getByTestId("card").getAttribute("data-severity")).toBe(severity);
      unmount();
    });
  });

  it("does not have transition or animation styles", () => {
    render(<Card severity="good" />);
    const card = screen.getByTestId("card") as HTMLElement;
    expect(card.style.transition).toBeFalsy();
    expect(card.style.animation).toBeFalsy();
  });

  it("can accept onClick and other event handlers", () => {
    const onClick = vi.fn();
    render(
      <Card onClick={onClick}>
        Click me
      </Card>
    );
    (screen.getByTestId("card") as HTMLElement).click();
    expect(onClick).toHaveBeenCalled();
  });

  it("can be nested with other elements", () => {
    render(
      <Card>
        <div data-testid="nested">Nested</div>
      </Card>
    );
    expect(screen.getByTestId("nested")).not.toBeNull();
    expect(screen.getByTestId("nested").parentElement).toBe(
      screen.getByTestId("card")
    );
  });
});
