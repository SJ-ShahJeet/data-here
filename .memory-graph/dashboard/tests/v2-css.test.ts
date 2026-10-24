import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Guards for app/v2/v2.css, the stylesheet behind the /v2 dashboard.
 */
describe("v2 stylesheet", () => {
  const css = readFileSync(join(__dirname, "..", "app", "v2", "v2.css"), "utf-8");
  const decls = css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("makes no network request (same offline rule as globals.css)", () => {
    expect(decls).not.toMatch(/@import/);
    expect(decls).not.toMatch(/https?:\/\//);
  });

  it("scopes every rule under .mg so it cannot leak into the Nocturne dashboard", () => {
    const selectors = decls
      .split("}")
      .map((block) => block.split("{")[0].trim())
      .filter((sel) => sel && !sel.startsWith("@"));
    for (const sel of selectors) {
      // Split on top-level commas only; `:where(a, b)` keeps its own list.
      for (const part of sel.split(/,(?![^(]*\))/)) {
        expect(part.trim(), `selector "${part.trim()}" is not scoped`).toMatch(/^\.mg(\b|-)/);
      }
    }
  });

  it("keeps element resets at class-level specificity so state classes win", () => {
    // `.mg button {…}` (0,1,1) would out-rank `.mg-pill--on` (0,1,0) and flatten
    // every selected state. The resets must go through :where().
    expect(decls).not.toMatch(/\.mg\s+(a|button|input|select|h1|h2|h3|p)\b/);
    expect(decls).toMatch(/\.mg :where\(button\)/);
  });
});
