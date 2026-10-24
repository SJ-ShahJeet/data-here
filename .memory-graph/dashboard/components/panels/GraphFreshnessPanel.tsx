import type { GraphFreshness } from "@/lib/scan";
import { StatusPill } from "@/components/ui/status-pill";
import { fmtWhen } from "@/lib/format";

export function GraphFreshnessPanel({ data }: { data: GraphFreshness }): React.JSX.Element {
  return (
    <section data-testid="panel-graph-freshness" data-severity="neutral" className="card mg-panel">
      <div className="mg-panel-head" style={{ marginBottom: "var(--space-2)" }}>
        <h2>Graph freshness</h2>
      </div>
      {!data.present ? (
        <p className="card-body" data-testid="panel-empty">
          No graph built — run /graphify . once
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <span data-testid="graph-behind">
            <StatusPill severity={data.behind ? "warning" : "good"}>
              {data.behind ? "Behind" : "Current"}
            </StatusPill>
          </span>
          {data.graph_mtime && (
            <div style={{ fontSize: "12px" }}>
              <span className="mg-quiet">Graph rebuilt</span>
              <br />
              <span className="mg-mono" title={data.graph_mtime}>
                {fmtWhen(data.graph_mtime)}
              </span>
            </div>
          )}
          {data.last_commit && (
            <div style={{ fontSize: "12px" }}>
              <span className="mg-quiet">Last commit</span>
              <br />
              <span className="mg-mono" title={data.last_commit}>
                {fmtWhen(data.last_commit)}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
