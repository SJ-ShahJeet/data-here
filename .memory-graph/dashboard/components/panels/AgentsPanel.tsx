import type { Agents } from "@/lib/scan";
import { StatusPill } from "@/components/ui/status-pill";

export function AgentsPanel({ data }: { data: Agents }): React.JSX.Element {
  return (
    <section data-testid="panel-agents" data-severity="neutral" className="card mg-panel">
      <div className="mg-panel-head" style={{ marginBottom: "var(--space-2)" }}>
        <h2>Agents</h2>
      </div>
      <table className="table" style={{ marginTop: "var(--space-2)" }}>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Brief</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.hosts.map((host) => (
            <tr
              key={host.name}
              data-testid="agent-row"
              data-host={host.name}
              data-installed={String(host.installed)}
            >
              <td style={{ fontSize: "13px" }}>{host.name}</td>
              <td className="text-muted" style={{ fontSize: "12px" }}>
                {host.brief_present && host.brief_mtime ? host.brief_mtime : "never"}
              </td>
              <td>
                <StatusPill severity={host.installed ? "good" : "neutral"}>
                  {host.installed ? "Installed" : "Not installed"}
                </StatusPill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
