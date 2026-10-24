import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/state/route";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("GET /api/state", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
    delete process.env.REPO_ROOT;
  });

  describe("response structure", () => {
    it("returns 200 status", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();

      expect(response.status).toBe(200);
    });

    it("returns application/json content type", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();

      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("sets Cache-Control to no-store", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();

      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });

    it("returns parseable JSON", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();

      expect(async () => {
        await response.json();
      }).not.toThrow();
    });
  });

  describe("response payload structure", () => {
    it("includes generated_at, repo, and freshness as first three keys", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      const keys = Object.keys(body);
      expect(keys.slice(0, 3)).toEqual(["generated_at", "repo", "freshness"]);
    });

    it("has generated_at as ISO UTC string", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      expect(typeof body.generated_at).toBe("string");
      expect(body.generated_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
      );
    });

    it("has repo as string", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      expect(typeof body.repo).toBe("string");
      expect(body.repo.length).toBeGreaterThan(0);
    });

    it("has freshness with correct structure", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      expect(body.freshness).toBeDefined();
      expect(body.freshness.present).toBeDefined();
      expect(body.freshness.state).toBeDefined();
      expect(body.freshness.updated).toBeDefined();
      expect(body.freshness.age_days).toBeDefined();
      expect(body.freshness.mtime).toBeDefined();
    });
  });

  describe("with real state.yaml", () => {
    it("returns good state when state.yaml is recent", async () => {
      // The route resolves freshness against the real current date, so the
      // fixture has to be relative. Hardcoding "updated: 2026-08-06" and
      // age_days: 2 passed on exactly one day and failed every day after.
      const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      await sandbox.write(
        "memory/state.yaml",
        `updated: ${twoDaysAgo}\nsessions_active: 1\n`
      );

      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      expect(body.freshness.present).toBe(true);
      expect(body.freshness.state).toBe("good");
      expect(body.freshness.updated).toBe(twoDaysAgo);
      expect(body.freshness.age_days).toBe(2);
    });

    it("returns stale state when state.yaml is old", async () => {
      const staleState = "updated: 2026-07-20\nsessions_active: 1\n";
      await sandbox.write("memory/state.yaml", staleState);

      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      expect(body.freshness.present).toBe(true);
      expect(body.freshness.state).toBe("stale");
      expect(body.freshness.updated).toBe("2026-07-20");
    });
  });

  describe("without state.yaml", () => {
    it("returns absent freshness when no state.yaml exists", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      expect(body.freshness.present).toBe(false);
      expect(body.freshness.state).toBe("absent");
      expect(body.freshness.updated).toBeNull();
      expect(body.freshness.age_days).toBeNull();
      expect(body.freshness.mtime).toBeNull();
    });

    it("still includes repo name even without state.yaml", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      expect(body.repo).toBeDefined();
      expect(typeof body.repo).toBe("string");
    });

    it("still includes generated_at even without state.yaml", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      expect(body.generated_at).toBeDefined();
      expect(typeof body.generated_at).toBe("string");
    });
  });

  describe("key insertion order", () => {
    it("maintains snake_case keys as first three items", async () => {
      await sandbox.write("memory/state.yaml", "updated: 2026-08-06\n");
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      const firstThreeKeys = Object.keys(body).slice(0, 3);
      expect(firstThreeKeys).toEqual(["generated_at", "repo", "freshness"]);
    });
  });

  describe("payload freshness structure", () => {
    it("uses snake_case keys in freshness object", async () => {
      await sandbox.write("memory/state.yaml", "updated: 2026-08-06\n");
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      const freshnessKeys = Object.keys(body.freshness);
      expect(freshnessKeys).toContain("present");
      expect(freshnessKeys).toContain("state");
      expect(freshnessKeys).toContain("updated");
      expect(freshnessKeys).toContain("age_days");
      expect(freshnessKeys).toContain("mtime");

      // Verify no camelCase
      expect(freshnessKeys).not.toContain("ageDays");
      expect(freshnessKeys).not.toContain("updated_at");
    });
  });

  describe("repo name derivation", () => {
    it("includes basename of root directory as repo", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      const expectedRepoName = require("path").basename(
        require("path").resolve(sandbox.root)
      );
      expect(body.repo).toBe(expectedRepoName);
    });
  });

  describe("generated_at timestamp", () => {
    it("is close to current time", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const beforeCall = Date.now();
      const response = await GET();
      const body = await response.json();
      const afterCall = Date.now();

      const generatedTime = new Date(body.generated_at).getTime();
      expect(generatedTime).toBeGreaterThanOrEqual(beforeCall - 1000);
      expect(generatedTime).toBeLessThanOrEqual(afterCall + 1000);
    });

    it("is in UTC (ends with Z)", async () => {
      process.env.REPO_ROOT = sandbox.root;
      const response = await GET();
      const body = await response.json();

      expect(body.generated_at).toMatch(/Z$/);
    });
  });

  describe("no logic, orchestration only", () => {
    it("calls collect(repoRoot()) and returns its result", async () => {
      await sandbox.write("memory/state.yaml", "updated: 2026-08-06\n");
      process.env.REPO_ROOT = sandbox.root;

      const response = await GET();
      const body = await response.json();

      // The body should be a valid DashboardState
      expect(body).toHaveProperty("generated_at");
      expect(body).toHaveProperty("repo");
      expect(body).toHaveProperty("freshness");
    });
  });
});
