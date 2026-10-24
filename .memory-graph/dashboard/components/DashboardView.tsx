"use client";

import type { DashboardState } from "@/lib/scan";
import { useLiveState } from "@/hooks/useLiveState";
import { useMotionSafe } from "@/hooks/useMotionSafe";
import { GradientShimmer } from "@/components/ui/gradient-shimmer";
import { StatTile } from "@/components/StatTile";
import { SavingsOverTime } from "@/components/charts/SavingsOverTime";
import { SessionCadence } from "@/components/charts/SessionCadence";
import { KnowsPanel } from "@/components/panels/KnowsPanel";
import { TimelinePanel } from "@/components/panels/TimelinePanel";
import { GraphPanel } from "@/components/panels/GraphPanel";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { PipelinePanel } from "@/components/panels/PipelinePanel";
import { GraphFreshnessPanel } from "@/components/panels/GraphFreshnessPanel";
import { TiersPanel } from "@/components/panels/TiersPanel";
import { AgentsPanel } from "@/components/panels/AgentsPanel";
import { CompressionPanel } from "@/components/panels/CompressionPanel";
import { DURATION, SHIMMER_RUNS, STAGGER } from "@/lib/motion-tokens";
import { freshnessTile, type Severity } from "@/lib/tiles";
import { pipelineHealth } from "@/lib/pipeline-health";
import { severityBoxShadow } from "@/components/ui/card";
import { useLastVisit } from "@/hooks/useLastVisit";
import { fmtInt, fmtWhen } from "@/lib/format";

interface Tile {
  id: string;
  label: string;
  value: string;
  sub: string;
  severity: Severity;
  spark: number[];
  action?: string;
}

export function DashboardView({ initial }: { initial: DashboardState }): React.JSX.Element {
  const { state } = useLiveState(initial);
  const motionSafe = useMotionSafe();
  const lastVisit = useLastVisit();

  const fresh = freshnessTile(state.freshness);
  const health = pipelineHealth(state.pipeline);

  const comp = state.compression;
  const savingsRatio =
    comp.present && comp.total_before > 0 ? 1 - comp.total_after / comp.total_before : null;

  const gf = state.graph_freshness;

  const tiles: Tile[] = [
    {
      id: "freshness",
      label: fresh.label,
      value: fresh.value,
      sub: fresh.sub,
      severity: fresh.severity,
      spark: [],
      action: fresh.action,
    },
    {
      id: "savings",
      label: "Token savings",
      value: savingsRatio === null ? "—" : `${Math.round(savingsRatio * 100)}%`,
      sub:
        savingsRatio === null
          ? "no compression events yet"
          : `${fmtInt(comp.total_saved)} tokens saved across ${comp.entries.length} events`,
      severity: savingsRatio === null ? "neutral" : "good",
      spark: comp.entries.map((e) => (e.before > 0 ? (1 - e.after / e.before) * 100 : 0)),
      action:
        savingsRatio === null
          ? "Tool-output compression is off in this repo — turn it on in Settings below."
          : undefined,
    },
    {
      id: "pipeline",
      label: "Pipeline health",
      value: health.value,
      sub: health.sub,
      severity: health.severity,
      // No sparkline: the four checks are categorical, not a series. Mapping them
      // to [1, 1, 0.2, 0.2] drew a descending line that read as a trend over time
      // when there is no time in it.
      spark: [],
      action: health.action,
    },
    {
      id: "graph",
      label: "Graph freshness",
      value: !gf.present ? "—" : gf.behind ? "Behind" : "Current",
      sub: !gf.present
        ? "no graph built"
        : gf.behind
          ? "older than last commit"
          : "rebuilt after last commit",
      severity: !gf.present ? "neutral" : gf.behind ? "warning" : "good",
      spark: [],
      action: !gf.present
        ? "Run /graphify . once to build it."
        : gf.behind
          ? "Rebuild it from Settings below, or commit again to trigger the hook."
          : undefined,
    },
  ];

  return (
    <div className="mg-page">
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: "var(--space-2)",
          ...(motionSafe
            ? { animation: `mg-fade-in ${DURATION.base}s ease-out both` }
            : {}),
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              marginBottom: "var(--space-2)",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="6" cy="6" r="2.4" />
              <circle cx="18" cy="6" r="2.4" />
              <circle cx="12" cy="18" r="2.4" />
              <path d="M7.7 7.3L11 16.5M16.3 7.3L13 16.5M8.4 6H15.6" />
            </svg>
            <span
              data-testid="repo-name"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: "14px" }}
            >
              {state.repo}
            </span>
            <span className="mg-quiet">/</span>
            <span style={{ fontSize: "13px", opacity: 0.7 }}>dashboard · live</span>
          </div>
          <GradientShimmer runs={SHIMMER_RUNS}>
            <h1
              style={{
                margin: 0,
                textShadow:
                  "0 0 12px rgba(145, 132, 217, 0.4), 0 0 32px rgba(145, 132, 217, 0.22), 0 0 64px rgba(145, 132, 217, 0.1)",
              }}
            >
              Memory dashboard
            </h1>
          </GradientShimmer>
        </div>
        <div style={{ fontSize: "12px", textAlign: "right" }}>
          <span className="mg-quiet">{lastVisit ? "You were last here" : "Read at"}</span>
          <br />
          <span className="mg-mono" title={lastVisit ?? state.generated_at}>
            {fmtWhen(lastVisit ?? state.generated_at)}
          </span>
        </div>
      </header>
      <GradientShimmer runs={SHIMMER_RUNS}>
        <p data-testid="lede" style={{ opacity: 0.6, maxWidth: "66ch", margin: "0 0 var(--space-8)" }}>
          Is memory healthy? What will the next session inherit? Is it saving tokens?
        </p>
      </GradientShimmer>

      <section data-testid="tile-row" className="mg-tiles">
        {tiles.map((tile, i) => (
          <div
            key={tile.id}
            className="card"
            data-stagger-index={String(i)}
            style={{
              // The ring is the tile row's severity channel. Without it every tile
              // was the same flat rectangle and the only loud object on the row was
              // the "Good" pill — the healthiest reading shouting over a critical
              // one. --severity-bad/warn resolve to the accent, --severity-good/idle
              // to the neutral ramp, so a problem now carries the perimeter and a
              // healthy tile recedes.
              boxShadow: severityBoxShadow(tile.severity),
              ...(motionSafe
                ? {
                    animation: `mg-fade-in ${DURATION.base}s ease-out both`,
                    animationDelay: `${i * STAGGER.tile}s`,
                  }
                : {}),
            }}
          >
            <StatTile {...tile} />
          </div>
        ))}
      </section>

      <main data-testid="panels">
        <section data-testid="zone-memory" className="mg-zone">
          <h3>Memory</h3>
          <div className="mg-cols" style={{ marginBottom: 0 }}>
            <KnowsPanel data={state.state} />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
              <TimelinePanel data={state.sessions} />
              <div className="card">
                <div className="card-title">Session cadence</div>
                <SessionCadence data={state.sessions} />
              </div>
            </div>
          </div>
        </section>

        <section data-testid="zone-pipeline-health" className="mg-zone">
          <h3>Pipeline &amp; health</h3>
          <div className="mg-grid-3" style={{ marginBottom: 0 }}>
            <CompressionPanel data={state.compression} />
            <div className="card">
              <div className="card-title">Savings over time</div>
              <SavingsOverTime data={state.compression} />
            </div>
            <PipelinePanel data={state.pipeline} />
            <GraphFreshnessPanel data={state.graph_freshness} />
            <TiersPanel data={state.tiers} />
            <AgentsPanel data={state.agents} />
          </div>
        </section>

        <section data-testid="zone-structure" className="mg-zone">
          <h3>Structure</h3>
          <GraphPanel data={state.graph} />
        </section>

        <section data-testid="zone-settings" className="mg-zone">
          <h3>Settings</h3>
          <SettingsPanel data={state.settings} />
        </section>
      </main>
    </div>
  );
}
