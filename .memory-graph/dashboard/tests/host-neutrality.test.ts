import { describe, it, expect } from "vitest";
import { readdirSync, lstatSync, readFileSync } from "fs";
import { join } from "path";

describe("host-neutrality", () => {
  const DASHBOARD_ROOT = join(__dirname, "..");
  // lib/v2/sample.ts is the fixture the v2 dashboard design was drawn with: a
  // fictional repository whose CI evidence reads ".github/workflows/…". That is
  // display copy about the sample repo, not a host path the dashboard reads.
  const EXCLUDED_FILES = new Set(["lib/mg-config.ts", "lib/v2/sample.ts"]);
  const HOST_LITERALS = [".cursor", ".claude", ".github"];
  const SKIP_DIRS = new Set(["node_modules", ".next"]);
  const VALID_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".json", ".mjs"]);

  function walkDirectory(dir: string, relativePath: string = ""): string[] {
    const violations: string[] = [];

    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const relPath = relativePath ? `${relativePath}/${entry}` : entry;

        if (SKIP_DIRS.has(entry)) {
          continue;
        }

        const stat = lstatSync(fullPath);

        if (stat.isDirectory()) {
          violations.push(...walkDirectory(fullPath, relPath));
        } else if (stat.isFile()) {
          const ext = fullPath.substring(fullPath.lastIndexOf("."));
          if (!VALID_EXTENSIONS.has(ext)) {
            continue;
          }

          if (EXCLUDED_FILES.has(relPath)) {
            continue;
          }

          // Test files are exempt, and must be. The rule being enforced is that
          // *production* code never hardcodes a host path — it reads HOSTS from
          // mg-config. Verifying that mg-config transcribed those paths
          // correctly, and that agents() detects them, requires tests that name
          // ".claude" and ".cursor" literally. Including test files here makes
          // the check fail on the very tests that prove the rule holds — and,
          // since this file lists the literals it greps for, on itself.
          if (/\.test\.tsx?$/.test(entry)) {
            continue;
          }

          try {
            const content = readFileSync(fullPath, "utf-8");

            for (const literal of HOST_LITERALS) {
              if (content.includes(literal)) {
                violations.push(
                  `${relPath} contains host literal '${literal}' — host paths must flow only through mg-config HOSTS`
                );
              }
            }
          } catch (err) {
            // Skip files we can't read
          }
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }

    return violations;
  }

  it("dashboard files should not contain host literals except mg-config.ts", () => {
    const violations = walkDirectory(DASHBOARD_ROOT);

    if (violations.length > 0) {
      throw new Error(
        `Host neutrality violations found:\n${violations.join("\n")}`
      );
    }
  });

  it("mg-config.ts is the only exception to host-neutrality rule", () => {
    const configPath = join(DASHBOARD_ROOT, "lib/mg-config.ts");
    const content = readFileSync(configPath, "utf-8");

    let hasHostLiterals = false;
    for (const literal of HOST_LITERALS) {
      if (content.includes(literal)) {
        hasHostLiterals = true;
        break;
      }
    }

    expect(hasHostLiterals).toBe(true);
  });

  it("finds no violations in lib/scan directory except mg-config.ts", () => {
    const scanDir = join(DASHBOARD_ROOT, "lib/scan");
    const violations = walkDirectory(scanDir, "lib/scan");

    const relevantViolations = violations.filter(
      (v) => !v.includes("mg-config.ts")
    );
    expect(relevantViolations).toEqual([]);
  });

  it("finds no violations in components/panels directory", () => {
    const panelsDir = join(DASHBOARD_ROOT, "components/panels");
    const violations = walkDirectory(panelsDir, "components/panels");

    expect(violations).toEqual([]);
  });

  it("finds no violations in app directory", () => {
    const appDir = join(DASHBOARD_ROOT, "app");
    const violations = walkDirectory(appDir, "app");

    const relevantViolations = violations.filter(
      (v) => !v.includes("mg-config.ts")
    );
    expect(relevantViolations).toEqual([]);
  });
});
