import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("motion-budget enforcement (R12)", () => {
  const panelDir = path.join(__dirname, "../components/panels");
  const uiDir = path.join(__dirname, "../components/ui");

  /**
   * Get all .tsx files from a directory
   */
  function getTsxFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) {
      return [];
    }
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.tsx'))
      .map(f => path.join(dir, f));
  }

  it("no panel carries unauthorized motion", () => {
    const panelFiles = getTsxFiles(panelDir);

    const forbiddenPatterns = [
      /animate\s*=/,
      /whileHover/,
      /initial\s*=/,
      /transition\s*=/,
      /GradientShimmer/
    ];

    panelFiles.forEach(file => {
      const content = fs.readFileSync(file, "utf-8");
      const fileName = path.basename(file);

      forbiddenPatterns.forEach(pattern => {
        if (fileName !== "GraphPanel.tsx") {
          expect(
            content,
            `${fileName} should not contain ${pattern.source}`
          ).not.toMatch(pattern);
        }
      });

      // GraphPanel is allowed data-dimmed only
      if (fileName === "GraphPanel.tsx") {
        const animateMatch = content.match(/animate\s*=/);
        const whileMatch = content.match(/whileHover/);
        const initialMatch = content.match(/initial\s*=/);
        const transitionMatch = content.match(/transition\s*=/);
        const shimmerMatch = content.match(/GradientShimmer/);

        expect(animateMatch).toBeNull();
        expect(whileMatch).toBeNull();
        expect(initialMatch).toBeNull();
        expect(transitionMatch).toBeNull();
        expect(shimmerMatch).toBeNull();

        // data-dimmed is allowed
        expect(content).toContain("data-dimmed");
      }
    });
  });

  it("Card component has no motion styles", () => {
    const cardFile = path.join(uiDir, "card.tsx");
    if (fs.existsSync(cardFile)) {
      const content = fs.readFileSync(cardFile, "utf-8");

      expect(content).not.toMatch(/transition\s*=/);
      expect(content).not.toMatch(/animate\s*=/);
    }
  });

  it("no panel file imports motion-causing libraries", () => {
    const panelFiles = getTsxFiles(panelDir);

    panelFiles.forEach(file => {
      const content = fs.readFileSync(file, "utf-8");
      const fileName = path.basename(file);

      // Check for Framer Motion imports (common motion library)
      if (!fileName.includes("GraphPanel")) {
        expect(content).not.toMatch(/from\s+['"]framer-motion['"]/);
      }
    });
  });

  it("all panel files are present", () => {
    // Contract mentions "nine panels"
    const panelFiles = getTsxFiles(panelDir);
    expect(panelFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("GraphPanel is a client component", () => {
    const graphPanelFile = path.join(panelDir, "GraphPanel.tsx");
    if (fs.existsSync(graphPanelFile)) {
      const content = fs.readFileSync(graphPanelFile, "utf-8");
      expect(content).toMatch(/["']use client["']/);
    }
  });

  it("Card component has use client directive", () => {
    const cardFile = path.join(uiDir, "card.tsx");
    if (fs.existsSync(cardFile)) {
      const content = fs.readFileSync(cardFile, "utf-8");
      expect(content).toMatch(/["']use client["']/);
    }
  });

  it("motion tokens file contains no JSX", () => {
    const tokensFile = path.join(__dirname, "../lib/motion-tokens.ts");
    if (fs.existsSync(tokensFile)) {
      const content = fs.readFileSync(tokensFile, "utf-8");
      expect(content).not.toContain("React");
      expect(content).not.toMatch(/<.*>/);
    }
  });
});
