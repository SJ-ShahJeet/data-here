import type { StatTileProps } from "@/lib/tiles";
import { StatusPill } from "@/components/ui/status-pill";
import { Sparkline } from "@/components/charts/Sparkline";

const PILL_LABEL: Record<StatTileProps["severity"], string> = {
  good: "Good",
  warning: "Warning",
  critical: "Critical",
  neutral: "Not set up",
};

export function StatTile(props: StatTileProps): React.JSX.Element {
  return (
    <section data-testid="stat-tile" data-severity={props.severity}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-2)",
        }}
      >
        <h2 data-testid="stat-tile-label" className="card-kicker" style={{ margin: 0 }}>
          {props.label}
        </h2>
        <StatusPill severity={props.severity}>{PILL_LABEL[props.severity]}</StatusPill>
      </div>
      <p
        data-testid="stat-tile-value"
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "28px",
          lineHeight: 1,
          margin: "0 0 var(--space-2)",
        }}
      >
        {props.value}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-2)",
        }}
      >
        <span data-testid="stat-tile-sub" style={{ fontSize: "12px", opacity: 0.55 }}>
          {props.sub}
        </span>
        {props.spark && props.spark.length > 1 ? (
          <span style={{ flex: "none", opacity: 0.7, width: 64 }}>
            <Sparkline values={props.spark} width={64} height={20} />
          </span>
        ) : null}
      </div>
      {props.action ? (
        <p data-testid="stat-tile-action" className="mg-tile-action">
          {props.action}
        </p>
      ) : null}
    </section>
  );
}
