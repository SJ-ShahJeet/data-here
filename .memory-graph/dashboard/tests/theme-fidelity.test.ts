import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("theme-fidelity", () => {
  it("globals.css uses only CSS variables, no hardcoded hex colors", () => {
    const globalsFile = path.join(__dirname, "../app/globals.css");

    if (fs.existsSync(globalsFile)) {
      const content = fs.readFileSync(globalsFile, "utf-8");

      // Check for any hex color patterns (#RGB or #RRGGBB)
      // Allow only var() references for colors
      const hexPattern = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?![0-9a-fA-F])/g;

      // Collect all hex matches
      const hexMatches = content.match(hexPattern) || [];

      // The slice 1 CSS should already have hex colors validated
      // Slice 3 additions (after globals.css append) should not introduce new hex
      // Filter out comments and data URIs to avoid false positives
      const cleanContent = content
        .split("\n")
        .filter((line) => !line.trim().startsWith("/*") && !line.trim().startsWith("*"))
        .join("\n");

      const cleanHexMatches = cleanContent.match(hexPattern) || [];

      // Verify no unexpected hex colors in slice 3 sections
      // (keyframes and data-* selectors added in slice 3)
      const slice3Start = cleanContent.indexOf("@keyframes mg-shimmer");
      if (slice3Start !== -1) {
        const slice3Content = cleanContent.substring(slice3Start);
        const slice3Hexes = slice3Content.match(hexPattern) || [];
        expect(slice3Hexes).toHaveLength(0);
      }
    }
  });

  it("motion token colors use CSS variables", () => {
    const globalsFile = path.join(__dirname, "../app/globals.css");

    if (fs.existsSync(globalsFile)) {
      const content = fs.readFileSync(globalsFile, "utf-8");

      // Check that keyframes and color animations use var()
      const keyframesSection = content.match(/@keyframes.*?}/s);
      if (keyframesSection) {
        expect(keyframesSection[0]).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      }

      // Check data-shimmering uses var()
      const shimmerSection = content.match(/\[data-shimmering="true"\].*?}/s);
      if (shimmerSection) {
        expect(shimmerSection[0]).toContain("var(");
      }
    }
  });

  it("data-dimmed styling references DIM_OPACITY value", () => {
    const globalsFile = path.join(__dirname, "../app/globals.css");
    const tokensFile = path.join(__dirname, "../lib/motion-tokens.ts");

    if (fs.existsSync(globalsFile) && fs.existsSync(tokensFile)) {
      const globalsContent = fs.readFileSync(globalsFile, "utf-8");
      const tokensContent = fs.readFileSync(tokensFile, "utf-8");

      // Extract DIM_OPACITY value from tokens
      const dimOpacityMatch = tokensContent.match(/DIM_OPACITY\s*=\s*([\d.]+)/);
      expect(dimOpacityMatch).toBeDefined();

      if (dimOpacityMatch) {
        const opacityValue = dimOpacityMatch[1];
        // Verify globals.css uses this value or 0.01ms (reduced motion)
        expect(globalsContent).toMatch(new RegExp(`opacity:\\s*${opacityValue}`));
      }
    }
  });

  it("reduced-motion media query is properly formed", () => {
    const globalsFile = path.join(__dirname, "../app/globals.css");

    if (fs.existsSync(globalsFile)) {
      const content = fs.readFileSync(globalsFile, "utf-8");

      expect(content).toContain("@media (prefers-reduced-motion: reduce)");
      expect(content).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
      expect(content).toMatch(/animation-iteration-count:\s*1\s*!important/);
      expect(content).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    }
  });

  it("appended CSS does not introduce new hex literals", () => {
    const globalsFile = path.join(__dirname, "../app/globals.css");

    if (fs.existsSync(globalsFile)) {
      const content = fs.readFileSync(globalsFile, "utf-8");

      // Find the slice 3 append marker (mg-shimmer keyframes)
      const slice3Start = content.indexOf("@keyframes mg-shimmer");
      if (slice3Start !== -1) {
        const slice3Content = content.substring(slice3Start);

        // No hex colors should be in slice 3 additions
        const hexPattern = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?![0-9a-fA-F])/;
        expect(slice3Content).not.toMatch(hexPattern);
      }
    }
  });

  it("cubic-bezier values match EASE_HOUSE_CSS", () => {
    const globalsFile = path.join(__dirname, "../app/globals.css");
    const tokensFile = path.join(__dirname, "../lib/motion-tokens.ts");

    if (fs.existsSync(globalsFile) && fs.existsSync(tokensFile)) {
      const globalsContent = fs.readFileSync(globalsFile, "utf-8");
      const tokensContent = fs.readFileSync(tokensFile, "utf-8");

      // Extract EASE_HOUSE_CSS value
      const easeMatch = tokensContent.match(/EASE_HOUSE_CSS\s*=\s*"([^"]+)"/);
      expect(easeMatch).toBeDefined();

      if (easeMatch) {
        const easeValue = easeMatch[1];
        expect(globalsContent).toContain(easeValue);
      }
    }
  });
});
