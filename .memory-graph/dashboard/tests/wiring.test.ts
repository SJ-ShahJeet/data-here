import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");

function readFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8");
  } catch (e) {
    throw new Error(`Failed to read ${filePath}: ${e}`);
  }
}

function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

describe("wiring", () => {
  describe("scripts/test.sh", () => {
    let testSh: string;

    beforeEach(() => {
      testSh = readFile(path.join(REPO, "scripts", "test.sh"));
    });

    it("includes npm dashboard test command", () => {
      expect(testSh).toContain('npm --prefix "$ROOT/dashboard" run test');
    });

    it("does NOT include old dashboard discover pattern", () => {
      expect(testSh).not.toContain('discover -s "$ROOT/dashboard"');
    });

    it("still includes engine tests discover pattern", () => {
      expect(testSh).toContain('discover -s "$ROOT/tests"');
    });

    it("does not reference dashboard as python module", () => {
      const dashboardPyLine = 'discover -s "$ROOT/dashboard"';
      expect(testSh).not.toContain(dashboardPyLine);
    });
  });

  describe("scripts/test-static.sh", () => {
    let testStaticSh: string;

    beforeEach(() => {
      testStaticSh = readFile(path.join(REPO, "scripts", "test-static.sh"));
    });

    it("does NOT include dashboard/*.py glob", () => {
      expect(testStaticSh).not.toContain("dashboard/*.py");
    });

    it("includes typecheck command", () => {
      expect(testStaticSh).toContain("run typecheck");
    });

    it("does not have unmatched glob that passes literally to python", () => {
      // The bug was that dashboard/*.py would fail when no .py files exist
      expect(testStaticSh).not.toContain("for f in $ENGINE/*.py dashboard/*.py");
    });

    it("includes new typescript check block", () => {
      expect(testStaticSh).toContain("== static: typescript ==");
    });
  });

  describe("scripts/dashboard.sh", () => {
    let dashboardSh: string;

    beforeEach(() => {
      dashboardSh = readFile(path.join(REPO, "scripts", "dashboard.sh"));
    });

    it("includes 127.0.0.1 host binding", () => {
      expect(dashboardSh).toContain("127.0.0.1");
    });

    it("includes run dev command", () => {
      expect(dashboardSh).toContain("run dev");
    });

    it("does NOT include old serve.py reference", () => {
      expect(dashboardSh).not.toContain("serve.py");
    });

    it("does not use localhost wildcard bind", () => {
      expect(dashboardSh).not.toContain("0.0.0.0");
      expect(dashboardSh).not.toContain("localhost");
    });

    it("exports REPO_ROOT environment variable", () => {
      expect(dashboardSh).toContain('export REPO_ROOT="$ROOT"');
    });

    it("installs dependencies if not present", () => {
      expect(dashboardSh).toContain("node_modules");
      expect(dashboardSh).toContain("npm --prefix");
      expect(dashboardSh).toContain("install");
    });
  });

  describe("setup file", () => {
    let setup: string;

    beforeEach(() => {
      setup = readFile(path.join(REPO, "setup"));
    });

    it("installs the dashboard inside memory-graph's single home", () => {
      expect(setup).toContain('_sync_dir "$(_src dashboard)" "$MG/dashboard"');
      expect(setup).toContain('MG="$TARGET/.memory-graph"');
    });

    it("installs memory, the session index and scripts into that same home", () => {
      expect(setup).toContain('"$MG/memory.md"');
      expect(setup).toContain('"$MG/memory/README.md"');
      expect(setup).toContain('mkdir -p "$MG/scripts"');
      expect(setup).toContain('"$MG/post-commit.sh"');
    });

    it("leaves only host-mandated files at the repo root", () => {
      // git reads .gitignore from the root and the agent opens AGENTS.md by
      // name, so those two cannot move into .memory-graph/.
      expect(setup).toContain('_install_file "$SCRIPT_DIR/.gitignore" "$TARGET/.gitignore"');
      expect(setup).toContain('_install_file "$SCRIPT_DIR/AGENTS.md"  "$TARGET/AGENTS.md"');
    });

    it("excludes node_modules from sync", () => {
      expect(setup).toContain("--exclude='node_modules'");
    });

    it("excludes .next build directory from sync", () => {
      expect(setup).toContain("--exclude='.next'");
    });

    it("has both node_modules and .next exclusions", () => {
      expect(setup).toContain("--exclude='node_modules'");
      expect(setup).toContain("--exclude='.next'");
    });

    it("does not copy huge build artifacts to consumers", () => {
      // The exclusions prevent multi-megabyte copies
      const syncLine = setup.match(
        /tar -cf -[^)]*--exclude='node_modules'[^)]*--exclude='\.next'/
      );
      expect(syncLine).toBeTruthy();
    });
  });

  describe(".gitignore", () => {
    let gitignore: string;

    beforeEach(() => {
      gitignore = readFile(path.join(REPO, ".gitignore"));
    });

    it("includes node_modules/ entry", () => {
      expect(gitignore).toContain("node_modules/");
    });

    it("includes .next/ entry", () => {
      expect(gitignore).toContain(".next/");
    });

    it("has both Node/Next.js entries", () => {
      expect(gitignore).toContain("node_modules/");
      expect(gitignore).toContain(".next/");
    });
  });

  // page.tsx is a thin server component: collect the state, hand it to the
  // client view. The markup these assertions used to look for lives in
  // components/DashboardView.tsx, so each one is checked against the file that
  // actually owns it rather than the entrypoint that delegates to it.
  describe("dashboard/app/page.tsx", () => {
    let pageFile: string;
    let viewFile: string;
    let statTileFile: string;

    beforeEach(() => {
      pageFile = readFile(path.join(REPO, "dashboard", "app", "page.tsx"));
      viewFile = readFile(
        path.join(REPO, "dashboard", "components", "DashboardView.tsx")
      );
      statTileFile = readFile(
        path.join(REPO, "dashboard", "components", "StatTile.tsx")
      );
    });

    it("delegates rendering to DashboardView", () => {
      expect(pageFile).toContain("DashboardView");
    });

    it("includes Memory dashboard heading", () => {
      expect(viewFile).toContain("Memory dashboard");
    });

    it("uses freshnessTile function", () => {
      expect(viewFile).toContain("freshnessTile");
    });

    it("renders the stat tile markup", () => {
      // DashboardView delegates tile markup to StatTile.tsx (Slice 7 dedup) —
      // checked here, not viewFile, for the same reason the describe block
      // above repoints assertions at the file that actually owns the markup.
      expect(viewFile).toContain("<StatTile");
      expect(statTileFile).toContain('data-testid="stat-tile"');
    });

    it("includes lede text in data-testid", () => {
      expect(viewFile).toContain('data-testid="lede"');
    });

    it("includes repo name in data-testid", () => {
      expect(viewFile).toContain('data-testid="repo-name"');
    });

    it("calls collect function", () => {
      expect(pageFile).toContain("collect");
    });
  });

  describe("deleted Python files", () => {
    const deletedFiles = [
      "dashboard/index.html",
      "dashboard/app.js",
      "dashboard/nocturne.css",
      "dashboard/serve.py",
      "dashboard/scan.py",
      "dashboard/__init__.py",
      "dashboard/test_scan.py",
      "dashboard/test_static_ui.py",
      "dashboard/test_wiring.py",
    ];

    deletedFiles.forEach((file) => {
      it(`${file} does not exist`, () => {
        const filePath = path.join(REPO, file);
        expect(fileExists(filePath)).toBe(false);
      });
    });
  });

  describe("file naming and location", () => {
    it("dashboard directory exists", () => {
      const dashDir = path.join(REPO, "dashboard");
      expect(fileExists(dashDir)).toBe(true);
    });

    it("dashboard/app directory exists", () => {
      const appDir = path.join(REPO, "dashboard", "app");
      expect(fileExists(appDir)).toBe(true);
    });

    it("dashboard/lib directory exists", () => {
      const libDir = path.join(REPO, "dashboard", "lib");
      expect(fileExists(libDir)).toBe(true);
    });
  });

  describe("forbidden host literals under dashboard/", () => {
    const forbiddenPatterns = [".cursor", ".claude", ".github"];
    let packageJson: string;
    let tsconfigJson: string;
    let nextConfig: string;

    beforeEach(() => {
      try {
        packageJson = readFile(path.join(REPO, "dashboard", "package.json"));
        tsconfigJson = readFile(path.join(REPO, "dashboard", "tsconfig.json"));
        nextConfig = readFile(path.join(REPO, "dashboard", "next.config.ts"));
      } catch {
        // Files might not exist yet during test phase
      }
    });

    forbiddenPatterns.forEach((pattern) => {
      it(`no .cursor/claude/github in dashboard/* files`, () => {
        if (packageJson) {
          expect(packageJson).not.toContain(pattern);
        }
        if (tsconfigJson) {
          expect(tsconfigJson).not.toContain(pattern);
        }
        if (nextConfig) {
          expect(nextConfig).not.toContain(pattern);
        }
      });
    });
  });

  describe("scripts directory integrity", () => {
    it("scripts/test.sh exists", () => {
      const testSh = path.join(REPO, "scripts", "test.sh");
      expect(fileExists(testSh)).toBe(true);
    });

    it("scripts/test-static.sh exists", () => {
      const testStaticSh = path.join(REPO, "scripts", "test-static.sh");
      expect(fileExists(testStaticSh)).toBe(true);
    });

    it("scripts/dashboard.sh exists", () => {
      const dashboardSh = path.join(REPO, "scripts", "dashboard.sh");
      expect(fileExists(dashboardSh)).toBe(true);
    });
  });

  describe("configuration files", () => {
    it("dashboard/package.json exists", () => {
      const pkgJson = path.join(REPO, "dashboard", "package.json");
      expect(fileExists(pkgJson)).toBe(true);
    });

    it("dashboard/tsconfig.json exists", () => {
      const tsConfig = path.join(REPO, "dashboard", "tsconfig.json");
      expect(fileExists(tsConfig)).toBe(true);
    });

    it("dashboard/vitest.config.ts exists", () => {
      const vitestConfig = path.join(REPO, "dashboard", "vitest.config.ts");
      expect(fileExists(vitestConfig)).toBe(true);
    });
  });

  describe("app structure", () => {
    it("dashboard/app/layout.tsx exists", () => {
      const layout = path.join(REPO, "dashboard", "app", "layout.tsx");
      expect(fileExists(layout)).toBe(true);
    });

    it("dashboard/app/page.tsx exists", () => {
      const page = path.join(REPO, "dashboard", "app", "page.tsx");
      expect(fileExists(page)).toBe(true);
    });

    it("dashboard/app/globals.css exists", () => {
      const globals = path.join(REPO, "dashboard", "app", "globals.css");
      expect(fileExists(globals)).toBe(true);
    });

    it("dashboard/app/api/state/route.ts exists", () => {
      const route = path.join(REPO, "dashboard", "app", "api", "state", "route.ts");
      expect(fileExists(route)).toBe(true);
    });
  });

  describe("library structure", () => {
    it("dashboard/lib/scan/freshness.ts exists", () => {
      const freshness = path.join(
        REPO,
        "dashboard",
        "lib",
        "scan",
        "freshness.ts"
      );
      expect(fileExists(freshness)).toBe(true);
    });

    it("dashboard/lib/scan/iso-utc.ts exists", () => {
      const isoUtc = path.join(REPO, "dashboard", "lib", "scan", "iso-utc.ts");
      expect(fileExists(isoUtc)).toBe(true);
    });

    it("dashboard/lib/scan/index.ts exists", () => {
      const index = path.join(REPO, "dashboard", "lib", "scan", "index.ts");
      expect(fileExists(index)).toBe(true);
    });

    it("dashboard/lib/tiles.ts exists", () => {
      const tiles = path.join(REPO, "dashboard", "lib", "tiles.ts");
      expect(fileExists(tiles)).toBe(true);
    });

    it("dashboard/lib/repo-root.ts exists", () => {
      const repoRoot = path.join(REPO, "dashboard", "lib", "repo-root.ts");
      expect(fileExists(repoRoot)).toBe(true);
    });
  });
});
