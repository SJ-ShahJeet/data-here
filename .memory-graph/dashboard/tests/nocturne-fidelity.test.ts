import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Pins app/globals.css against the Nocturne design system as imported from the
 * Claude Design project (_ds/nocturne-75d52d64-.../styles.css).
 *
 * The reason this file exists: the first build of this dashboard shipped a
 * generic dark palette while claiming to be Nocturne, and passed every test,
 * because the tests asserted class *names* rather than token *values*. These
 * assertions check values.
 */
describe("nocturne fidelity", () => {
  const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8");

  // Colour assertions run against declarations only. A comment that *names* a
  // rejected colour — explaining why it was removed — is not a violation, and
  // the alternative is prose that cannot say what it is talking about.
  const decls = css.replace(/\/\*[\s\S]*?\*\//g, "");

  describe("offline rule", () => {
    it("makes no network request of any kind", () => {
      // Nocturne's own styles.css opens with a Google Fonts @import. Vendoring
      // it verbatim re-broke the offline guarantee once already.
      expect(decls).not.toMatch(/@import\s+url\(/);
      expect(decls).not.toMatch(/https?:\/\//);
    });
  });

  describe("core tokens match the design system", () => {
    const tokens: Array<[string, string]> = [
      ["--color-bg", "#161826"],
      ["--color-surface", "#232532"],
      ["--color-text", "#e9e9ed"],
      ["--color-accent", "#9184d9"],
      ["--color-accent-2", "#a7a1db"],
      ["--background", "#161826"],
      ["--card", "#232532"],
      ["--primary", "#9184d9"],
    ];

    for (const [name, value] of tokens) {
      it(`${name} is ${value}`, () => {
        expect(css).toMatch(new RegExp(`${name}\\s*:\\s*${value}\\s*;`, "i"));
      });
    }

    it("uses the blurple accent, not a generic blue", () => {
      expect(decls).not.toMatch(/#58a6ff/i);
      expect(decls).not.toMatch(/#0d1117/i);
    });
  });

  describe("no colours the design system does not define", () => {
    it("introduces no red or amber", () => {
      // Nocturne ships an accent ramp and a neutral ramp. It has no red and no
      // amber: pillStyle() separates all four severities with border,
      // background and font-weight instead of hue.
      expect(decls).not.toMatch(/#d98499/i); // invented "destructive" red
      expect(decls).not.toMatch(/#d9c184/i); // invented "warning" amber
    });

    it("draws severity edges from the accent and neutral ramps only", () => {
      const allowed = ["#9184d9", "#9397ab", "#595d6c", "#75798c"];
      const found = [...decls.matchAll(/--severity-[a-z]+:\s*(#[0-9a-f]{6})/gi)].map(
        (m) => m[1].toLowerCase()
      );
      expect(found.length).toBeGreaterThan(0);
      for (const colour of found) expect(allowed).toContain(colour);
    });
  });

  describe("scales", () => {
    it("carries Nocturne's 2.8px-based space scale", () => {
      for (const [name, value] of [
        ["--space-1", "2.8px"],
        ["--space-2", "5.6px"],
        ["--space-3", "8.4px"],
        ["--space-4", "11.2px"],
        ["--space-6", "16.8px"],
        ["--space-8", "22.4px"],
      ]) {
        expect(css).toMatch(new RegExp(`${name}\\s*:\\s*${value}\\s*;`));
      }
    });

    it("radius-lg is 14px everywhere, never aliased to 8px", () => {
      expect(css).toMatch(/--radius-lg:\s*14px\s*;/);
      expect(css).not.toMatch(/--radius-lg:\s*var\(--radius\)/);
    });
  });

  describe("the end-fading rule signature", () => {
    // styles.css calls this out by name: rules fade to transparent over 48px
    // at both ends rather than stopping cleanly.
    it("fades freestanding rules via .hr", () => {
      expect(css).toMatch(/\.hr\s*\{[^}]*linear-gradient\(to right/);
    });

    it("fades table row rules over 48px", () => {
      expect(css).toMatch(/\.table thead tr\s*\{[^}]*48px/);
      expect(css).toMatch(/\.table tbody tr\s*\{[^}]*48px/);
    });
  });

  describe("pill styles mirror the design's pillStyle()", () => {
    it("good uses the accent for text, border and a 14% tint", () => {
      expect(css).toMatch(
        /\.pill-good\s*\{[^}]*color-mix\(in srgb, var\(--color-accent\) 14%/
      );
    });

    it("critical uses neutral-500 border, neutral-800 ground and weight 600", () => {
      const block = /\.pill-critical\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
      expect(block).toContain("--color-neutral-500");
      expect(block).toContain("--color-neutral-800");
      expect(block).toContain("font-weight: 600");
    });
  });
});
