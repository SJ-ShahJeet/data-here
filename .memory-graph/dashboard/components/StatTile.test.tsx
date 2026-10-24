// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatTile } from "@/components/StatTile";
import type { StatTileProps } from "@/lib/tiles";

describe("StatTile", () => {
  describe("rendering structure", () => {
    it("renders section with data-testid stat-tile", () => {
      const props: StatTileProps = {
        label: "Test Label",
        value: "42",
        sub: "Test Sub",
        severity: "good",
      };

      const { getByTestId } = render(<StatTile {...props} />);
      const section = getByTestId("stat-tile");

      expect(section).toBeInTheDocument();
      expect(section.tagName).toBe("SECTION");
    });

    it("renders h2 with label text and data-testid stat-tile-label", () => {
      const props: StatTileProps = {
        label: "Memory freshness",
        value: "2d",
        sub: "updated 2026-08-06",
        severity: "good",
      };

      const { getByTestId } = render(<StatTile {...props} />);
      const label = getByTestId("stat-tile-label");

      expect(label).toBeInTheDocument();
      expect(label.tagName).toBe("H2");
      expect(label.textContent).toBe("Memory freshness");
    });

    it("renders p with value text and data-testid stat-tile-value", () => {
      const props: StatTileProps = {
        label: "Test",
        value: "7d",
        sub: "test sub",
        severity: "warning",
      };

      const { getByTestId } = render(<StatTile {...props} />);
      const value = getByTestId("stat-tile-value");

      expect(value).toBeInTheDocument();
      expect(value.tagName).toBe("P");
      expect(value.textContent).toBe("7d");
    });

    it("renders span with sub text and data-testid stat-tile-sub", () => {
      const props: StatTileProps = {
        label: "Test",
        value: "31d",
        sub: "last written 2026-07-08",
        severity: "critical",
      };

      const { getByTestId } = render(<StatTile {...props} />);
      const sub = getByTestId("stat-tile-sub");

      expect(sub).toBeInTheDocument();
      expect(sub.tagName).toBe("SPAN");
      expect(sub.textContent).toBe("last written 2026-07-08");
    });
  });

  describe("data-severity attribute", () => {
    it("sets data-severity to 'good' string", () => {
      const props: StatTileProps = {
        label: "Test",
        value: "2d",
        sub: "test",
        severity: "good",
      };

      const { getByTestId } = render(<StatTile {...props} />);
      const section = getByTestId("stat-tile");

      expect(section).toHaveAttribute("data-severity", "good");
    });

    it("sets data-severity to 'warning' string", () => {
      const props: StatTileProps = {
        label: "Test",
        value: "19d",
        sub: "test",
        severity: "warning",
      };

      const { getByTestId } = render(<StatTile {...props} />);
      const section = getByTestId("stat-tile");

      expect(section).toHaveAttribute("data-severity", "warning");
    });

    it("sets data-severity to 'critical' string", () => {
      const props: StatTileProps = {
        label: "Test",
        value: "68d",
        sub: "test",
        severity: "critical",
      };

      const { getByTestId } = render(<StatTile {...props} />);
      const section = getByTestId("stat-tile");

      expect(section).toHaveAttribute("data-severity", "critical");
    });

    it("sets data-severity to 'neutral' string", () => {
      const props: StatTileProps = {
        label: "Test",
        value: "—",
        sub: "test",
        severity: "neutral",
      };

      const { getByTestId } = render(<StatTile {...props} />);
      const section = getByTestId("stat-tile");

      expect(section).toHaveAttribute("data-severity", "neutral");
    });

    it("uses raw severity string, not class name", () => {
      const props: StatTileProps = {
        label: "Test",
        value: "5d",
        sub: "test",
        severity: "good",
      };

      const { getByTestId } = render(<StatTile {...props} />);
      const section = getByTestId("stat-tile");

      const severityAttr = section.getAttribute("data-severity");
      expect(severityAttr).toBe("good");
      // Ensure it's not a class name format
      expect(severityAttr).not.toContain("-");
      expect(severityAttr).not.toMatch(/^(bg|text|border)/);
    });
  });

  describe("all severity levels", () => {
    const severities: Array<"good" | "warning" | "critical" | "neutral"> = [
      "good",
      "warning",
      "critical",
      "neutral",
    ];

    severities.forEach((severity) => {
      it(`renders with severity ${severity}`, () => {
        const props: StatTileProps = {
          label: `Test ${severity}`,
          value: "5d",
          sub: `sub for ${severity}`,
          severity,
        };

        const { getByTestId } = render(<StatTile {...props} />);
        const section = getByTestId("stat-tile");

        expect(section).toHaveAttribute("data-severity", severity);
      });
    });
  });

  describe("content rendering", () => {
    it("renders em dash in value", () => {
      const props: StatTileProps = {
        label: "Memory freshness",
        value: "—",
        sub: "no state.yaml yet",
        severity: "neutral",
      };

      const { getByTestId } = render(<StatTile {...props} />);
      const value = getByTestId("stat-tile-value");

      expect(value.textContent).toBe("—");
    });

    it("renders complex sub text with date", () => {
      const props: StatTileProps = {
        label: "Memory freshness",
        value: "2d",
        sub: "updated 2026-08-06",
        severity: "good",
      };

      const { getByTestId } = render(<StatTile {...props} />);
      const sub = getByTestId("stat-tile-sub");

      expect(sub.textContent).toContain("2026-08-06");
      expect(sub.textContent).toBe("updated 2026-08-06");
    });
  });

  describe("element hierarchy", () => {
    it("contains all required child elements in section", () => {
      const props: StatTileProps = {
        label: "Memory freshness",
        value: "2d",
        sub: "updated 2026-08-06",
        severity: "good",
      };

      const { getByTestId } = render(<StatTile {...props} />);
      const section = getByTestId("stat-tile");

      const label = section.querySelector("[data-testid='stat-tile-label']");
      const value = section.querySelector("[data-testid='stat-tile-value']");
      const sub = section.querySelector("[data-testid='stat-tile-sub']");

      expect(label).toBeInTheDocument();
      expect(value).toBeInTheDocument();
      expect(sub).toBeInTheDocument();
    });
  });
});
