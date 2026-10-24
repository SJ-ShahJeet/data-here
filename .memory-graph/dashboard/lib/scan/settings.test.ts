import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { settings } from "@/lib/scan/settings";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("settings", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("MEMORY_") || key === "NOT_MEMORY") {
        delete process.env[key];
      }
    }
  });

  describe("happy paths", () => {
    it("returns profile from config or default", () => {
      const result = settings(sandbox.root);

      expect(result.profile).toBe("standard");
      expect(typeof result.profile).toBe("string");
    });

    it("returns track from config or default", () => {
      const result = settings(sandbox.root);

      expect(result.track).toBe("auto");
      expect(typeof result.track).toBe("string");
    });

    it("returns config object from loadConfig", () => {
      const result = settings(sandbox.root);

      expect(result.config).toBeDefined();
      expect(typeof result.config).toBe("object");
      expect(result.config.profile).toBe("standard");
    });

    it("returns env_overrides as object", () => {
      const result = settings(sandbox.root);

      expect(result.env_overrides).toBeDefined();
      expect(typeof result.env_overrides).toBe("object");
    });

    it("has correct key order: profile, track, config, env_overrides", () => {
      const result = settings(sandbox.root);
      const keys = Object.keys(result);

      expect(keys).toEqual(["profile", "track", "config", "env_overrides"]);
    });
  });

  describe("profile handling", () => {
    it("uses config profile if available", () => {
      sandbox.write(".memory-graph/config.yaml", "profile: token-first\n");
      const result = settings(sandbox.root);

      expect(result.profile).toBe("token-first");
    });

    it("defaults to standard if config has no profile", () => {
      const result = settings(sandbox.root);

      expect(result.profile).toBe("standard");
    });

    it("coerces profile to string", () => {
      sandbox.write(".memory-graph/config.yaml", "profile: minimal\n");
      const result = settings(sandbox.root);

      expect(typeof result.profile).toBe("string");
      expect(result.profile).toBe("minimal");
    });
  });

  describe("track handling", () => {
    it("uses config track if available", () => {
      sandbox.write(".memory-graph/config.yaml", "track: manual\n");
      const result = settings(sandbox.root);

      expect(result.track).toBe("manual");
    });

    it("defaults to auto if config has no track", () => {
      const result = settings(sandbox.root);

      expect(result.track).toBe("auto");
    });

    it("coerces track to string", () => {
      sandbox.write(".memory-graph/config.yaml", "track: manual\n");
      const result = settings(sandbox.root);

      expect(typeof result.track).toBe("string");
    });
  });

  describe("env_overrides", () => {
    it("includes MEMORY_ prefixed env vars", () => {
      process.env.MEMORY_FOO = "bar";
      const result = settings(sandbox.root);

      expect(result.env_overrides.MEMORY_FOO).toBe("bar");
    });

    it("excludes non-MEMORY_ prefixed vars", () => {
      process.env.NOT_MEMORY = "ignored";
      const result = settings(sandbox.root);

      expect(result.env_overrides.NOT_MEMORY).toBeUndefined();
    });

    it("sorts env vars ascending by code point", () => {
      process.env.MEMORY_Z = "last";
      process.env.MEMORY_A = "first";
      process.env.MEMORY_M = "middle";
      const result = settings(sandbox.root);

      const keys = Object.keys(result.env_overrides);
      expect(keys).toEqual(["MEMORY_A", "MEMORY_M", "MEMORY_Z"]);
    });

    it("coerces env values to strings", () => {
      process.env.MEMORY_FOO = "123";
      const result = settings(sandbox.root);

      expect(result.env_overrides.MEMORY_FOO).toBe("123");
      expect(typeof result.env_overrides.MEMORY_FOO).toBe("string");
    });

    it("returns empty object when no MEMORY_ vars set", () => {
      const result = settings(sandbox.root);

      expect(result.env_overrides).toEqual({});
    });

    it("handles multiple MEMORY_ vars", () => {
      process.env.MEMORY_VAR1 = "val1";
      process.env.MEMORY_VAR2 = "val2";
      process.env.MEMORY_VAR3 = "val3";
      const result = settings(sandbox.root);

      expect(Object.keys(result.env_overrides).length).toBe(3);
      expect(result.env_overrides.MEMORY_VAR1).toBe("val1");
      expect(result.env_overrides.MEMORY_VAR2).toBe("val2");
      expect(result.env_overrides.MEMORY_VAR3).toBe("val3");
    });
  });

  describe("config integration", () => {
    it("passes through full config object", () => {
      sandbox.write(
        ".memory-graph/config.yaml",
        `profile: token-first
track: manual
core:
  agent_brief_max_lines: 60
`
      );
      const result = settings(sandbox.root);

      expect(result.config.profile).toBe("token-first");
      expect(result.config.track).toBe("manual");
      expect(result.config.agent_brief_max_lines).toBe(60);
    });

    it("config is JSON stringifiable", () => {
      const result = settings(sandbox.root);

      expect(() => {
        JSON.stringify(result.config);
      }).not.toThrow();
    });

    it("result is JSON stringifiable", () => {
      const result = settings(sandbox.root);

      expect(() => {
        JSON.stringify(result);
      }).not.toThrow();
    });
  });

  describe("fixture: env override test", () => {
    it("fixture matches contract exactly", () => {
      process.env.MEMORY_FOO = "1";
      process.env.NOT_MEMORY = "2";
      const result = settings(sandbox.root);

      expect(result.env_overrides).toEqual({ MEMORY_FOO: "1" });
    });
  });

  describe("error cases", () => {
    it("never throws on missing config", () => {
      expect(() => {
        settings(sandbox.root);
      }).not.toThrow();
    });

    it("never throws on invalid config", () => {
      sandbox.write(".memory-graph/config.yaml", "{ invalid yaml }");
      expect(() => {
        settings(sandbox.root);
      }).not.toThrow();
    });

    it("uses defaults on invalid config", () => {
      sandbox.write(".memory-graph/config.yaml", "broken\n");
      const result = settings(sandbox.root);

      expect(result.profile).toBe("standard");
      expect(result.track).toBe("auto");
    });
  });
});
