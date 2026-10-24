import type { Pipeline, PipelineCheck } from "@/lib/scan/pipeline";
import type { Severity } from "@/lib/tiles";

/**
 * How to read a pipeline status file.
 *
 * `lib/scan/pipeline.ts` reports one fact per check — is the status file there.
 * It deliberately says nothing about what absence *means*, and its contract test
 * pins the shape of what it returns, so the reading lives here instead.
 *
 * The distinction matters because the four checks are not the same kind of thing:
 *
 * - A **feature** is opt-in. Its file appears once you enable it, so absence means
 *   "not enabled", not "broken". Counting an unconfigured feature as a failure is
 *   what made the tile read `2/4 · Warning` on a repo where nothing was wrong.
 * - An **attention** flag is the inverse: its file appears only when the engine
 *   wants something from you, so presence is the signal, not absence.
 */
export type CheckKind = "feature" | "attention";

export const CHECK_KIND: Record<string, CheckKind> = {
  agent_brief: "feature",
  semantic_pending: "attention",
  semantic_ollama: "feature",
  graph_scout: "feature",
};

/** Human name for a check, so the UI never prints a raw status-file key. */
export const CHECK_LABEL: Record<string, string> = {
  agent_brief: "Agent brief",
  semantic_pending: "Semantic compression",
  semantic_ollama: "Ollama compression",
  graph_scout: "Graph scout",
};

export function checkKind(name: string): CheckKind {
  return CHECK_KIND[name] ?? "feature";
}

export function checkLabel(name: string): string {
  return CHECK_LABEL[name] ?? name;
}

/**
 * The engine writes these files for itself, so a first line can carry a leading
 * `#` comment marker or a trailing colon. Neither belongs in a table cell.
 */
export function cleanDetail(detail: string): string {
  return detail.replace(/^#+\s*/, "").replace(/\s*:\s*$/, "").trim();
}

export interface CheckStatus {
  severity: Severity;
  label: string;
}

/** What one check's presence means, given its kind. */
export function checkStatus(check: PipelineCheck): CheckStatus {
  if (checkKind(check.name) === "attention") {
    return check.present
      ? { severity: "warning", label: "action needed" }
      : { severity: "good", label: "clear" };
  }
  return check.present
    ? { severity: "good", label: "active" }
    : { severity: "neutral", label: "not enabled" };
}

export interface PipelineHealth {
  severity: Severity;
  value: string;
  sub: string;
  action?: string;
  /** Enabled optional features. Attention flags are not features and never counted. */
  activeCount: number;
  featureCount: number;
  /** Attention flags currently raised, by human label. */
  raised: string[];
}

export function pipelineHealth(p: Pipeline): PipelineHealth {
  const features = p.checks.filter((c) => checkKind(c.name) === "feature");
  const attention = p.checks.filter((c) => checkKind(c.name) === "attention");

  const activeCount = features.filter((c) => c.present).length;
  const featureCount = features.length;
  const raised = attention.filter((c) => c.present).map((c) => checkLabel(c.name));

  if (featureCount === 0) {
    return {
      severity: "neutral",
      value: "—",
      sub: "no checks configured",
      activeCount: 0,
      featureCount: 0,
      raised,
    };
  }

  const value = `${activeCount}/${featureCount}`;

  if (raised.length > 0) {
    return {
      severity: "warning",
      value,
      sub:
        raised.length === 1
          ? `${raised[0].toLowerCase()} is recommended`
          : `${raised.length} items need attention`,
      action: "Run it from Settings below.",
      activeCount,
      featureCount,
      raised,
    };
  }

  if (activeCount === 0) {
    return {
      severity: "neutral",
      value,
      sub: "no optional features enabled",
      action: "All four are optional — turn them on in Settings below.",
      activeCount,
      featureCount,
      raised,
    };
  }

  return {
    severity: "good",
    value,
    sub:
      activeCount === featureCount
        ? "every optional feature active"
        : `${activeCount} of ${featureCount} optional features active · nothing needs attention`,
    activeCount,
    featureCount,
    raised,
  };
}
