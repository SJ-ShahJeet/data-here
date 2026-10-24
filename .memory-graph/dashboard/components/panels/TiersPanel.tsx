import type { Tiers } from "@/lib/scan";
import { fmtBytes } from "@/lib/format";

const TIER_META: Record<string, { label: string }> = {
  hot: { label: "Hot" },
  warm: { label: "Warm" },
  cold: { label: "Cold" },
  brief: { label: "Brief" },
};

export function TiersPanel({ data }: { data: Tiers }): React.JSX.Element {
  const isEmpty =
    !data.hot.present && !data.brief.present && data.warm.count === 0 && data.cold.count === 0;

  const tierOrder: Array<"hot" | "warm" | "cold" | "brief"> = ["hot", "warm", "cold", "brief"];

  return (
    <section data-testid="panel-tiers" data-severity="neutral" className="card mg-panel">
      <div className="mg-panel-head" style={{ marginBottom: "var(--space-2)" }}>
        <h2>Tier breakdown</h2>
      </div>
      {isEmpty ? (
        <p className="card-body" data-testid="panel-empty">
          No tier data
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            marginTop: "var(--space-2)",
          }}
        >
          {tierOrder.map((tierName) => {
            const tier = data[tierName];
            const value =
              tierName === "hot" || tierName === "brief"
                ? (tier as { present: boolean }).present
                  ? fmtBytes(tier.bytes)
                  : "—"
                : `${(tier as { count: number }).count} files · ${fmtBytes(tier.bytes)}`;
            return (
              <div
                key={tierName}
                data-testid="tier-row"
                data-tier={tierName}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "var(--space-2)",
                  borderBottom: "1px solid var(--color-divider)",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px" }}>{TIER_META[tierName].label}</div>
                  <div className="mg-quiet" style={{ fontSize: "11px" }}>{tier.path}</div>
                </div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: "15px" }}>{value}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
