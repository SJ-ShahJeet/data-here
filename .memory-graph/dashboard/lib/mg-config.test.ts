import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  HOSTS,
  INTERNAL_PREFIXES,
  INTERNAL_FILES,
  isInternalPath,
  installedHosts,
  DEFAULTS,
  PROFILE_PRESETS,
  loadConfig,
  HOME_DIR,
  OWNED_PATHS,
  mgHome,
  mgPath,
  memoryDir,
  sessionsDir,
  graphDir,
  graphJson,
  memoryIndex,
  isLegacyLayout,
} from "@/lib/mg-config";
import path from "path";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";

describe("mg-config constants", () => {
  describe("HOSTS registry", () => {
    it("has exactly three entries: cursor, claude, copilot", () => {
      const keys = Object.keys(HOSTS);
      expect(keys).toEqual(["cursor", "claude", "copilot"]);
    });

    it("cursor entry has correct structure", () => {
      expect(HOSTS.cursor).toEqual({
        brief: ".cursor/rules/main.mdc",
        marker: ".cursor/hooks.json",
        internal: [".cursor/"],
      });
    });

    it("claude entry has correct structure", () => {
      expect(HOSTS.claude).toEqual({
        brief: "CLAUDE.md",
        marker: ".claude/settings.json",
        internal: [".claude/"],
      });
    });

    it("copilot entry has correct structure", () => {
      expect(HOSTS.copilot).toEqual({
        brief: ".github/copilot-instructions.md",
        marker: ".github/hooks/memory-graph.json",
        internal: [".github/"],
      });
    });

    it("is readonly", () => {
      expect(() => {
        // @ts-expect-error - testing readonly
        HOSTS.cursor = undefined;
      }).toThrow();
    });
  });

  describe("INTERNAL_PREFIXES", () => {
    it("contains all expected prefixes in order", () => {
      expect(INTERNAL_PREFIXES).toEqual([
        ".claude/",
        ".cursor/",
        ".github/",
        ".memory-graph/",
        "sessions/",
        "graphify-out/",
        "memory/",
      ]);
    });

    it("is readonly", () => {
      expect(() => {
        // @ts-expect-error - testing readonly
        INTERNAL_PREFIXES[0] = "x";
      }).toThrow();
    });
  });

  describe("INTERNAL_FILES", () => {
    it("contains exactly three files", () => {
      expect(INTERNAL_FILES.size).toBe(3);
    });

    it("contains memory.md, CLAUDE.md, AGENTS.md", () => {
      expect(INTERNAL_FILES.has("memory.md")).toBe(true);
      expect(INTERNAL_FILES.has("CLAUDE.md")).toBe(true);
      expect(INTERNAL_FILES.has("AGENTS.md")).toBe(true);
    });

    it("is typed as a ReadonlySet containing the expected files", () => {
      expect(INTERNAL_FILES).toBeInstanceOf(Set);
      expect(INTERNAL_FILES.has("memory.md")).toBe(true);
      expect(INTERNAL_FILES.has("CLAUDE.md")).toBe(true);
      expect(INTERNAL_FILES.has("AGENTS.md")).toBe(true);
    });
  });

  describe("DEFAULTS", () => {
    it("includes all documented keys", () => {
      const expectedKeys = [
        "profile",
        "track",
        "git_noise_threshold",
        "scope_max",
        "session_fill_from_transcript",
        "session_context_max_chars",
        "archive_why_fields",
        "archive_enrich_on_move",
        "archive_monthly_summary",
        "graph_summary_on_stop",
        "session_min_files",
        "graph_scout_local",
        "graph_scout_budget",
        "graph_scout_summarize",
        "graph_scout_on_stop",
        "agent_brief",
        "agent_brief_max_lines",
        "inject_budget_tokens",
        "inject_kinds",
        "inject_min_weight",
        "decay_half_life_days",
        "tool_output_compress",
        "tool_output_min_chars",
        "tool_output_max_summary",
        "ollama_context_on_start",
        "ollama_context_max_lines",
        "ollama_context_cache_mins",
        "ollama_context_max_chars",
        "enabled",
        "host",
        "model",
        "max_archive_chars",
        "max_archive_files",
        "timeout",
        "temperature",
      ];
      const keys = Object.keys(DEFAULTS);
      expect(keys).toEqual(expectedKeys);
    });

    it("has correct default values", () => {
      expect(DEFAULTS.profile).toBe("standard");
      expect(DEFAULTS.track).toBe("auto");
      expect(DEFAULTS.git_noise_threshold).toBe(25);
      expect(DEFAULTS.scope_max).toBe(40);
      expect(DEFAULTS.session_fill_from_transcript).toBe(true);
      expect(DEFAULTS.session_context_max_chars).toBe(600);
      expect(DEFAULTS.inject_budget_tokens).toBe(6000);
      expect(DEFAULTS.inject_kinds).toBe("Decision,Constraint,Open thread,Dependency,Test/CI fact");
      expect(DEFAULTS.inject_min_weight).toBe(0.3);
      expect(DEFAULTS.decay_half_life_days).toBe(30);
      expect(DEFAULTS.tool_output_compress).toBe(true);
      expect(DEFAULTS.tool_output_min_chars).toBe(6000);
      expect(DEFAULTS.tool_output_max_summary).toBe(1200);
      expect(DEFAULTS.enabled).toBe(false);
      expect(DEFAULTS.host).toBe("http://127.0.0.1:11434");
      expect(DEFAULTS.model).toBe("llama3.2:3b");
      expect(DEFAULTS.timeout).toBe(120);
      expect(DEFAULTS.temperature).toBe(0.0);
    });
  });

  describe("PROFILE_PRESETS", () => {
    it("has three presets: minimal, standard, token-first", () => {
      const keys = Object.keys(PROFILE_PRESETS);
      expect(keys).toEqual(["minimal", "standard", "token-first"]);
    });

    it("minimal preset disables graph features", () => {
      expect(PROFILE_PRESETS.minimal.graph_scout_on_stop).toBe(false);
    });

    it("standard preset enables core features", () => {
      expect(PROFILE_PRESETS.standard.agent_brief).toBe(true);
      expect(PROFILE_PRESETS.standard.tool_output_compress).toBe(true);
    });

    it("token-first preset optimizes for context", () => {
      expect(PROFILE_PRESETS["token-first"]).toBeDefined();
    });

    it("presets are readonly", () => {
      expect(() => {
        // @ts-expect-error - testing readonly
        PROFILE_PRESETS.minimal = {};
      }).toThrow();
    });
  });
});

describe("isInternalPath", () => {
  describe("happy paths", () => {
    it("returns true for empty path", () => {
      expect(isInternalPath("")).toBe(true);
    });

    it("returns true for leading ./ stripped", () => {
      expect(isInternalPath("./file")).toBe(false); // "file" is not internal
    });

    it("returns true for INTERNAL_FILES member", () => {
      expect(isInternalPath("memory.md")).toBe(true);
      expect(isInternalPath("CLAUDE.md")).toBe(true);
      expect(isInternalPath("AGENTS.md")).toBe(true);
    });

    it("returns true for paths starting with .claude/", () => {
      expect(isInternalPath(".claude/settings.json")).toBe(true);
      expect(isInternalPath(".claude/hooks/memory-graph.json")).toBe(true);
    });

    it("returns true for paths starting with .cursor/", () => {
      expect(isInternalPath(".cursor/rules/main.mdc")).toBe(true);
    });

    it("returns true for paths starting with .github/", () => {
      expect(isInternalPath(".github/hooks/memory-graph.json")).toBe(true);
    });

    it("returns true for paths starting with .memory-graph/", () => {
      expect(isInternalPath(".memory-graph/engine/compress-tool-output.py")).toBe(
        true
      );
    });

    it("returns true for paths starting with sessions/", () => {
      expect(isInternalPath("sessions/2026-08-07-1.md")).toBe(true);
    });

    it("returns true for paths starting with graphify-out/", () => {
      expect(isInternalPath("graphify-out/graph.json")).toBe(true);
    });

    it("returns true for paths starting with memory/", () => {
      expect(isInternalPath("memory/state.yaml")).toBe(true);
      expect(isInternalPath("memory/.compression-log.jsonl")).toBe(true);
    });

    it("returns false for regular source files", () => {
      expect(isInternalPath("src/index.ts")).toBe(false);
      expect(isInternalPath("dashboard/lib/scan.ts")).toBe(false);
      expect(isInternalPath("README.md")).toBe(false);
    });

    it("strips leading ./", () => {
      expect(isInternalPath("./memory.md")).toBe(true);
      expect(isInternalPath("./.claude/settings.json")).toBe(true);
    });

    it("strips leading slashes", () => {
      expect(isInternalPath("/memory.md")).toBe(true);
      expect(isInternalPath("/.claude/settings.json")).toBe(true);
    });

    it("trims whitespace", () => {
      expect(isInternalPath("  .claude/settings.json  ")).toBe(true);
      expect(isInternalPath("  memory.md  ")).toBe(true);
    });
  });
});

describe("installedHosts", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("happy paths", () => {
    it("returns empty array when no markers exist", () => {
      const result = installedHosts(sandbox.root);
      expect(result).toEqual([]);
    });

    it("returns cursor when .cursor/hooks.json exists", () => {
      sandbox.write(".cursor/hooks.json", "{}");
      const result = installedHosts(sandbox.root);
      expect(result).toContain("cursor");
    });

    it("returns claude when .claude/settings.json exists", () => {
      sandbox.write(".claude/settings.json", "{}");
      const result = installedHosts(sandbox.root);
      expect(result).toContain("claude");
    });

    it("returns copilot when .github/hooks/memory-graph.json exists", () => {
      sandbox.write(".github/hooks/memory-graph.json", "{}");
      const result = installedHosts(sandbox.root);
      expect(result).toContain("copilot");
    });

    it("returns all three when all markers exist", () => {
      sandbox.write(".cursor/hooks.json", "{}");
      sandbox.write(".claude/settings.json", "{}");
      sandbox.write(".github/hooks/memory-graph.json", "{}");
      const result = installedHosts(sandbox.root);
      expect(result).toEqual(["cursor", "claude", "copilot"]);
    });

    it("returns in HOSTS insertion order (cursor, claude, copilot)", () => {
      sandbox.write(".github/hooks/memory-graph.json", "{}");
      sandbox.write(".cursor/hooks.json", "{}");
      sandbox.write(".claude/settings.json", "{}");
      const result = installedHosts(sandbox.root);
      expect(result).toEqual(["cursor", "claude", "copilot"]);
    });

    it("never throws", () => {
      expect(() => {
        installedHosts("/nonexistent/path");
      }).not.toThrow();
    });
  });

  describe("error cases", () => {
    it("ignores directories with marker name", () => {
      sandbox.mkdir(".claude/hooks");
      const result = installedHosts(sandbox.root);
      expect(result).not.toContain("claude");
    });

    it("ignores marker in subdirectory", () => {
      sandbox.write(".claude/subdir/settings.json", "{}");
      const result = installedHosts(sandbox.root);
      expect(result).not.toContain("claude");
    });
  });
});

describe("loadConfig", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("happy paths", () => {
    it("returns DEFAULTS when config.yaml is absent", () => {
      const result = loadConfig(sandbox.root);
      expect(result.profile).toBe("standard");
      expect(result.track).toBe("auto");
      expect(result.enabled).toBe(false);
    });

    it("applies profile preset", () => {
      sandbox.write(".memory-graph/config.yaml", "profile: token-first\n");
      const result = loadConfig(sandbox.root);
      expect(result.profile).toBe("token-first");
    });

    it("loads core section", () => {
      sandbox.write(
        ".memory-graph/config.yaml",
        `core:
  agent_brief_max_lines: 60
`
      );
      const result = loadConfig(sandbox.root);
      expect(result.agent_brief_max_lines).toBe(60);
    });

    it("loads ollama section", () => {
      sandbox.write(
        ".memory-graph/config.yaml",
        `ollama:
  enabled: true
  model: "llama3.2:1b"
`
      );
      const result = loadConfig(sandbox.root);
      expect(result.enabled).toBe(true);
      expect(result.model).toBe("llama3.2:1b");
      expect(result.ollama_enabled).toBe(true);
    });

    it("coerces numeric strings to numbers", () => {
      sandbox.write(
        ".memory-graph/config.yaml",
        `git_noise_threshold: 50
scope_max: 100
`
      );
      const result = loadConfig(sandbox.root);
      expect(result.git_noise_threshold).toBe(50);
      expect(result.scope_max).toBe(100);
      expect(typeof result.git_noise_threshold).toBe("number");
    });

    it("coerces boolean strings", () => {
      sandbox.write(
        ".memory-graph/config.yaml",
        `agent_brief: false
tool_output_compress: true
`
      );
      const result = loadConfig(sandbox.root);
      expect(result.agent_brief).toBe(false);
      expect(result.tool_output_compress).toBe(true);
      expect(typeof result.agent_brief).toBe("boolean");
    });

    it("handles floating point numbers", () => {
      sandbox.write(".memory-graph/config.yaml", `temperature: 0.5\n`);
      const result = loadConfig(sandbox.root);
      expect(result.temperature).toBe(0.5);
    });

    it("strips quotes from quoted values", () => {
      sandbox.write(
        ".memory-graph/config.yaml",
        `model: "llama3.2:3b"
host: 'http://127.0.0.1:11434'
`
      );
      const result = loadConfig(sandbox.root);
      expect(result.model).toBe("llama3.2:3b");
      expect(result.host).toBe("http://127.0.0.1:11434");
    });

    it("sets ollama_enabled false when enabled is absent", () => {
      sandbox.write(".memory-graph/config.yaml", `profile: standard\n`);
      const result = loadConfig(sandbox.root);
      expect(result.ollama_enabled).toBe(false);
    });

    it("never throws on missing file", () => {
      expect(() => {
        loadConfig(sandbox.root);
      }).not.toThrow();
    });
  });

  describe("fixture: config with profile, core, and ollama", () => {
    it("applies preset then core then ollama overrides", () => {
      sandbox.write(
        ".memory-graph/config.yaml",
        `profile: token-first
track: manual
core:
  agent_brief_max_lines: 60
ollama:
  enabled: true
  model: "llama3.2:1b"
`
      );
      const result = loadConfig(sandbox.root);
      expect(result.profile).toBe("token-first");
      expect(result.track).toBe("manual");
      expect(result.agent_brief_max_lines).toBe(60);
      expect(result.model).toBe("llama3.2:1b");
      expect(result.enabled).toBe(true);
      expect(result.ollama_enabled).toBe(true);
    });
  });
});

describe("layout registry", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  it("mirrors the names in mg_config.py's OWNED_PATHS", () => {
    expect(HOME_DIR).toBe(".memory-graph");
    expect(Object.keys(OWNED_PATHS)).toEqual([
      "memory",
      "sessions",
      "graph",
      "index",
      "scripts",
      "dashboard",
    ]);
  });

  it("resolves into the single home when nothing exists yet", () => {
    // A fresh repo has neither layout on disk, so new writes must land in the
    // consolidated home rather than scattering across the root.
    expect(memoryDir(sandbox.root)).toBe(`${sandbox.root}/${HOME_DIR}/memory`);
    expect(sessionsDir(sandbox.root)).toBe(`${sandbox.root}/${HOME_DIR}/sessions`);
    expect(graphDir(sandbox.root)).toBe(`${sandbox.root}/${HOME_DIR}/graphify-out`);
    expect(memoryIndex(sandbox.root)).toBe(`${sandbox.root}/${HOME_DIR}/memory.md`);
    expect(mgHome(sandbox.root)).toBe(`${sandbox.root}/${HOME_DIR}`);
  });

  it("prefers the consolidated home when it exists", () => {
    sandbox.mkdir(`${HOME_DIR}/memory`);
    sandbox.write(`${HOME_DIR}/graphify-out/graph.json`, "{}");
    expect(memoryDir(sandbox.root)).toBe(`${sandbox.root}/${HOME_DIR}/memory`);
    expect(graphJson(sandbox.root)).toBe(
      `${sandbox.root}/${HOME_DIR}/graphify-out/graph.json`
    );
  });

  it("falls back to the legacy top-level layout so old repos keep working", () => {
    sandbox.mkdir("memory");
    sandbox.mkdir("sessions");
    sandbox.write("memory.md", "# index\n");
    expect(memoryDir(sandbox.root)).toBe(`${sandbox.root}/memory`);
    expect(sessionsDir(sandbox.root)).toBe(`${sandbox.root}/sessions`);
    expect(memoryIndex(sandbox.root)).toBe(`${sandbox.root}/memory.md`);
  });

  it("takes the consolidated home even when a legacy directory is also present", () => {
    // Mid-migration a repo can briefly have both; the new home must win, or
    // writes would keep landing in the directory being retired.
    sandbox.mkdir("memory");
    sandbox.mkdir(`${HOME_DIR}/memory`);
    expect(mgPath(sandbox.root, "memory")).toBe(`${sandbox.root}/${HOME_DIR}/memory`);
  });

  it("picks one layout for the whole repo, never a mix", () => {
    // Only sessions/ exists at the root. Resolving paths independently would
    // put state.yaml in the new home while sessions stayed behind, and the
    // index's relative links would point at nothing.
    sandbox.mkdir("sessions");
    expect(isLegacyLayout(sandbox.root)).toBe(true);
    expect(memoryDir(sandbox.root)).toBe(`${sandbox.root}/memory`);
    expect(memoryIndex(sandbox.root)).toBe(`${sandbox.root}/memory.md`);
    expect(path.dirname(memoryIndex(sandbox.root))).toBe(
      path.dirname(sessionsDir(sandbox.root))
    );
  });

  it("does not mistake the project's own scripts/ for memory-graph's", () => {
    sandbox.mkdir("scripts");
    sandbox.mkdir("dashboard");
    expect(isLegacyLayout(sandbox.root)).toBe(false);
    expect(memoryDir(sandbox.root)).toBe(`${sandbox.root}/${HOME_DIR}/memory`);
  });
});
