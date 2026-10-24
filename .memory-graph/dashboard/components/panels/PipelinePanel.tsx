import type { Pipeline } from "@/lib/scan";
import { StatusPill } from "@/components/ui/status-pill";
import { checkLabel, checkStatus, cleanDetail } from "@/lib/pipeline-health";

export function PipelinePanel({ data }: { data: Pipeline }): React.JSX.Element {
  const isEmpty = data.checks.every((c) => !c.present);

  return (
    <section data-testid="panel-pipeline" data-severity="neutral" className="card mg-panel">
      <div className="mg-panel-head" style={{ marginBottom: "var(--space-2)" }}>
        <h2>Pipeline health</h2>
      </div>
      {isEmpty ? (
        <p className="card-body" data-testid="panel-empty">
          No pipeline status files yet
        </p>
      ) : (
        <table className="table" style={{ marginTop: "var(--space-2)" }}>
          <thead>
            <tr>
              <th>Check</th>
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {data.checks.map((check) => {
              // `present` alone is not a verdict. For an opt-in feature, absence
              // means "not enabled"; for the semantic-compression flag, presence is
              // the request for action. Mapping present → "good" for both rendered
              // a check that wants something from you in the success treatment.
              const status = checkStatus(check);
              return (
                <tr
                  key={check.name}
                  data-testid="pipeline-row"
                  data-check={check.name}
                  data-present={String(check.present)}
                >
                  <td style={{ fontSize: "12.5px" }} title={check.path}>
                    {checkLabel(check.name)}
                  </td>
                  <td>
                    <StatusPill severity={status.severity}>{status.label}</StatusPill>
                  </td>
                  <td className="text-muted" style={{ fontSize: "12px" }}>
                    {check.present ? cleanDetail(check.detail) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
