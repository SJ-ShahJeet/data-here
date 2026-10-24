import { describe, it, expect } from "vitest";
import {
  checkKind,
  checkLabel,
  checkStatus,
  cleanDetail,
  pipelineHealth,
} from "@/lib/pipeline-health";
import type { Pipeline, PipelineCheck } from "@/lib/scan/pipeline";

function check(name: string, present: boolean, detail = ""): PipelineCheck {
  return {
    name,
    path: `memory/.${name}`,
    present,
    mtime: present ? "2026-08-14T12:00:00Z" : null,
    detail,
  };
}

/** The real four checks, in the order lib/scan/pipeline.ts emits them. */
function makePipeline(present: Partial<Record<string, boolean>> = {}): Pipeline {
  return {
    checks: [
      check("agent_brief", present.agent_brief ?? false),
      check("semantic_pending", present.semantic_pending ?? false),
      check("semantic_ollama", present.semantic_ollama ?? false),
      check("graph_scout", present.graph_scout ?? false),
    ],
  };
}

describe("checkKind", () => {
  it("treats the three opt-in status files as features", () => {
    expect(checkKind("agent_brief")).toBe("feature");
    expect(checkKind("semantic_ollama")).toBe("feature");
    expect(checkKind("graph_scout")).toBe("feature");
  });

  it("treats semantic_pending as an attention flag", () => {
    expect(checkKind("semantic_pending")).toBe("attention");
  });

  it("defaults an unknown check to a feature", () => {
    expect(checkKind("something_new")).toBe("feature");
  });
});

describe("checkLabel", () => {
  it("gives every known check a human name", () => {
    expect(checkLabel("agent_brief")).toBe("Agent brief");
    expect(checkLabel("semantic_pending")).toBe("Semantic compression");
  });

  it("falls back to the raw key rather than inventing a name", () => {
    expect(checkLabel("something_new")).toBe("something_new");
  });
});

describe("cleanDetail", () => {
  it("strips the leading comment marker the engine writes", () => {
    expect(cleanDetail("# Structural memory hit a limit — semantic compress recommended.")).toBe(
      "Structural memory hit a limit — semantic compress recommended."
    );
  });

  it("strips a trailing colon", () => {
    expect(cleanDetail("ok:")).toBe("ok");
  });

  it("leaves ordinary detail untouched", () => {
    expect(cleanDetail("ok: brief written")).toBe("ok: brief written");
  });

  it("returns empty for empty input", () => {
    expect(cleanDetail("")).toBe("");
  });
});

describe("checkStatus", () => {
  it("reads an absent feature as not enabled, never as a failure", () => {
    expect(checkStatus(check("graph_scout", false))).toEqual({
      severity: "neutral",
      label: "not enabled",
    });
  });

  it("reads a present feature as active", () => {
    expect(checkStatus(check("graph_scout", true))).toEqual({
      severity: "good",
      label: "active",
    });
  });

  it("inverts the attention flag: present means action needed", () => {
    expect(checkStatus(check("semantic_pending", true))).toEqual({
      severity: "warning",
      label: "action needed",
    });
  });

  it("inverts the attention flag: absent means clear", () => {
    expect(checkStatus(check("semantic_pending", false))).toEqual({
      severity: "good",
      label: "clear",
    });
  });
});

describe("pipelineHealth", () => {
  it("does not count the attention flag as a feature", () => {
    const health = pipelineHealth(makePipeline());
    expect(health.featureCount).toBe(3);
  });

  it("reports good when some optional features are on and nothing is raised", () => {
    const health = pipelineHealth(makePipeline({ agent_brief: true, graph_scout: true }));

    expect(health.severity).toBe("good");
    expect(health.value).toBe("2/3");
    expect(health.raised).toEqual([]);
    expect(health.action).toBeUndefined();
  });

  it("does not warn merely because optional features are unconfigured", () => {
    // The regression this module exists for: two of four status files absent used
    // to render "2/4 · Warning" on a repo where nothing was wrong.
    const health = pipelineHealth(makePipeline({ agent_brief: true }));

    expect(health.severity).not.toBe("warning");
    expect(health.severity).not.toBe("critical");
    expect(health.severity).toBe("good");
  });

  it("warns only when the attention flag is actually raised", () => {
    const health = pipelineHealth(
      makePipeline({ agent_brief: true, semantic_pending: true })
    );

    expect(health.severity).toBe("warning");
    expect(health.raised).toEqual(["Semantic compression"]);
    expect(health.action).toBeTruthy();
  });

  it("reports every feature active without claiming more than it can", () => {
    const health = pipelineHealth(
      makePipeline({ agent_brief: true, semantic_ollama: true, graph_scout: true })
    );

    expect(health.severity).toBe("good");
    expect(health.value).toBe("3/3");
    expect(health.sub).toBe("every optional feature active");
  });

  it("reports neutral, not critical, when nothing is enabled at all", () => {
    const health = pipelineHealth(makePipeline());

    expect(health.severity).toBe("neutral");
    expect(health.value).toBe("0/3");
    expect(health.action).toBeTruthy();
  });

  it("handles a pipeline with no checks", () => {
    const health = pipelineHealth({ checks: [] });

    expect(health.severity).toBe("neutral");
    expect(health.value).toBe("—");
    expect(health.featureCount).toBe(0);
  });

  it("still warns when the flag is raised and no feature is enabled", () => {
    const health = pipelineHealth(makePipeline({ semantic_pending: true }));

    expect(health.severity).toBe("warning");
  });
});
