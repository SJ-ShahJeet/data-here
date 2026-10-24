import type { Freshness } from "./scan/freshness";

export type Severity = "good" | "warning" | "critical" | "neutral";

export interface StatTileProps {
  label: string;
  value: string;
  sub: string;
  severity: Severity;
  spark?: number[];
  /**
   * What to do about a reading that is not `good`. A tile that reports a problem
   * and stops there leaves the reader to guess whether the number is bad because
   * they were away or because the pipeline broke — the one question this surface
   * exists to answer. Omitted on healthy tiles: there is nothing to do.
   */
  action?: string;
}

export function freshnessTile(f: Freshness): StatTileProps {
  if (f.state === "absent") {
    return {
      label: "Memory freshness",
      value: "—",
      sub: "no state.yaml yet",
      severity: "neutral",
      action: "No session has ended in this repo yet.",
    };
  }

  if (f.state === "good") {
    return {
      label: "Memory freshness",
      value: `${f.age_days}d`,
      sub: `updated ${f.updated}`,
      severity: "good",
    };
  }

  if (f.state === "stale") {
    return {
      label: "Memory freshness",
      value: `${f.age_days}d`,
      sub: `last written ${f.updated}`,
      severity: "warning",
      action: "Normal after a break. If you have been working here, the stop hook may not be firing.",
    };
  }

  // state === "old"
  return {
    label: "Memory freshness",
    value: `${f.age_days}d`,
    sub: `last written ${f.updated}`,
    severity: "critical",
    action: "If you have been working in this repo since then, the stop hook is not firing.",
  };
}
