import type { Compression } from "@/lib/scan";
import { fmtInt } from "@/lib/format";

export function CompressionPanel({ data }: { data: Compression }): React.JSX.Element {
  return (
    <section data-testid="panel-compression" data-severity="neutral" className="card mg-panel">
      <div className="mg-panel-head" style={{ marginBottom: "var(--space-2)" }}>
        <h2>Compression history</h2>
      </div>
      {!data.present ? (
        <p className="card-body" data-testid="panel-empty">
          No compressed tool outputs yet
        </p>
      ) : (
        <table className="table" style={{ marginTop: "var(--space-2)" }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Tool</th>
              <th>Before</th>
              <th>After</th>
              <th>Cut</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((entry, idx) => (
              <tr key={idx} data-testid="compression-row">
                <td className="text-muted" style={{ fontSize: "12px" }}>
                  {entry.at}
                </td>
                <td className="text-muted" style={{ fontSize: "12px" }}>
                  {entry.tool}
                </td>
                <td className="text-muted">{fmtInt(entry.before)}</td>
                <td>{fmtInt(entry.after)}</td>
                <td style={{ color: "var(--color-accent-300)" }}>
                  {entry.before > 0
                    ? `-${Math.round((entry.saved / entry.before) * 100)}%`
                    : fmtInt(entry.saved)}
                </td>
              </tr>
            ))}
            <tr data-testid="compression-total">
              <td style={{ fontWeight: 600 }}>Total</td>
              <td></td>
              <td className="text-muted">{fmtInt(data.total_before)}</td>
              <td>{fmtInt(data.total_after)}</td>
              <td style={{ color: "var(--color-accent-300)" }}>
                {data.total_before > 0
                  ? `-${Math.round((data.total_saved / data.total_before) * 100)}%`
                  : fmtInt(data.total_saved)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
