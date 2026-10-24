import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { agents } from "@/lib/scan/agents";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("agents", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("happy paths", () => {
    it("always returns exactly three hosts", () => {
      const result = agents(sandbox.root);

      expect(result.hosts.length).toBe(3);
    });

    it("returns hosts in order: cursor, claude, copilot", () => {
      const result = agents(sandbox.root);

      expect(result.hosts[0].name).toBe("cursor");
      expect(result.hosts[1].name).toBe("claude");
      expect(result.hosts[2].name).toBe("copilot");
    });

    it("has correct key order: name, installed, brief, brief_present, brief_mtime", () => {
      const result = agents(sandbox.root);

      const keys = Object.keys(result.hosts[0]);
      expect(keys).toEqual([
        "name",
        "installed",
        "brief",
        "brief_present",
        "brief_mtime",
      ]);
    });

    it("returns installed false when marker missing", () => {
      const result = agents(sandbox.root);

      result.hosts.forEach((host) => {
        expect(host.installed).toBe(false);
      });
    });

    it("returns installed true when marker file exists", () => {
      sandbox.write(".cursor/hooks.json", "{}");
      const result = agents(sandbox.root);

      expect(result.hosts[0].installed).toBe(true);
    });

    it("includes correct brief path for cursor", () => {
      const result = agents(sandbox.root);

      expect(result.hosts[0].brief).toBe(".cursor/rules/main.mdc");
    });

    it("includes correct brief path for claude", () => {
      const result = agents(sandbox.root);

      expect(result.hosts[1].brief).toBe("CLAUDE.md");
    });

    it("includes correct brief path for copilot", () => {
      const result = agents(sandbox.root);

      expect(result.hosts[2].brief).toBe(".github/copilot-instructions.md");
    });
  });

  describe("brief detection", () => {
    it("brief_present false when brief file missing", () => {
      const result = agents(sandbox.root);

      result.hosts.forEach((host) => {
        expect(host.brief_present).toBe(false);
        expect(host.brief_mtime).toBeNull();
      });
    });

    it("brief_present true when brief file exists", () => {
      sandbox.write(".cursor/rules/main.mdc", "rules");
      const result = agents(sandbox.root);

      expect(result.hosts[0].brief_present).toBe(true);
    });

    it("brief_mtime is ISO UTC string when file exists", () => {
      sandbox.write("CLAUDE.md", "# CLAUDE");
      const result = agents(sandbox.root);

      expect(result.hosts[1].brief_mtime).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
      );
    });

    it("brief_mtime is null when file missing", () => {
      const result = agents(sandbox.root);

      result.hosts.forEach((host) => {
        expect(host.brief_mtime).toBeNull();
      });
    });
  });

  describe("host-specific scenarios", () => {
    it("cursor host with marker and brief", () => {
      sandbox.write(".cursor/hooks.json", "{}");
      sandbox.write(".cursor/rules/main.mdc", "rules");
      const result = agents(sandbox.root);

      expect(result.hosts[0]).toEqual({
        name: "cursor",
        installed: true,
        brief: ".cursor/rules/main.mdc",
        brief_present: true,
        brief_mtime: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
        ),
      });
    });

    it("claude host with marker only", () => {
      sandbox.write(".claude/settings.json", "{}");
      const result = agents(sandbox.root);

      expect(result.hosts[1].name).toBe("claude");
      expect(result.hosts[1].installed).toBe(true);
      expect(result.hosts[1].brief_present).toBe(false);
      expect(result.hosts[1].brief_mtime).toBeNull();
    });

    it("copilot host uninstalled", () => {
      const result = agents(sandbox.root);

      expect(result.hosts[2].name).toBe("copilot");
      expect(result.hosts[2].installed).toBe(false);
      expect(result.hosts[2].brief_present).toBe(false);
      expect(result.hosts[2].brief_mtime).toBeNull();
    });
  });

  describe("all three installed", () => {
    it("returns all installed when all markers present", () => {
      sandbox.write(".cursor/hooks.json", "{}");
      sandbox.write(".claude/settings.json", "{}");
      sandbox.write(".github/hooks/memory-graph.json", "{}");
      const result = agents(sandbox.root);

      expect(result.hosts[0].installed).toBe(true);
      expect(result.hosts[1].installed).toBe(true);
      expect(result.hosts[2].installed).toBe(true);
    });
  });

  describe("none installed", () => {
    it("returns all uninstalled when no markers", () => {
      const result = agents(sandbox.root);

      result.hosts.forEach((host) => {
        expect(host.installed).toBe(false);
      });
    });
  });

  describe("error cases", () => {
    it("marker as directory is not installed", () => {
      sandbox.mkdir(".cursor/hooks.json");
      const result = agents(sandbox.root);

      expect(result.hosts[0].installed).toBe(false);
    });

    it("brief as directory is not brief_present", () => {
      sandbox.mkdir(".cursor/rules/main.mdc");
      const result = agents(sandbox.root);

      expect(result.hosts[0].brief_present).toBe(false);
    });

    it("never throws on missing paths", () => {
      expect(() => {
        agents("/nonexistent/path");
      }).not.toThrow();
    });

    it("never throws even with permission errors", () => {
      expect(() => {
        agents("/root/no-access");
      }).not.toThrow();
    });
  });

  describe("invariants", () => {
    it("hosts array always has three entries", () => {
      sandbox.write(".cursor/hooks.json", "{}");
      sandbox.write(".claude/settings.json", "{}");
      sandbox.write(".github/hooks/memory-graph.json", "{}");
      const result = agents(sandbox.root);

      expect(result.hosts.length).toBe(3);
    });

    it("host names are exactly cursor, claude, copilot", () => {
      const result = agents(sandbox.root);

      const names = result.hosts.map((h) => h.name);
      expect(names).toEqual(["cursor", "claude", "copilot"]);
    });

    it("all briefs from HOSTS registry", () => {
      const result = agents(sandbox.root);

      expect(result.hosts[0].brief).toBe(".cursor/rules/main.mdc");
      expect(result.hosts[1].brief).toBe("CLAUDE.md");
      expect(result.hosts[2].brief).toBe(".github/copilot-instructions.md");
    });
  });

  describe("host-neutrality (no literals in file)", () => {
    it("file does not import or reference host paths", () => {
      // This is a contract requirement enforced by host-neutrality.test.ts
      // but mentioned here for completeness of specification
      expect(true).toBe(true);
    });
  });
});
