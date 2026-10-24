"use client";
import type { FleetTotals, Repo } from "@/lib/v2/types";

export function Fleet({ repos, totals }: { repos: Repo[]; totals: FleetTotals }) {
  return (
    <div className="mg-screen" data-testid="mg-fleet">
      <div className="mg-stats">
        <div className="mg-stat">
          <div className="mg-stat__label">Repos indexed</div>
          <div className="mg-stat__value" style={{ marginTop: 7 }}>{totals.repos}</div>
        </div>
        <div className="mg-stat">
          <div className="mg-stat__label">Tokens saved · 30d</div>
          <div className="mg-stat__value mg-stat__value--accent" style={{ marginTop: 7 }}>{totals.saved}</div>
        </div>
        <div className="mg-stat">
          <div className="mg-stat__label">Median coverage</div>
          <div className="mg-stat__value" style={{ marginTop: 7 }}>{totals.medianCoverage}</div>
        </div>
        <div className="mg-stat" style={{ borderRight: 0 }}>
          <div className="mg-stat__label">Unreviewed · fleet</div>
          <div className="mg-stat__value mg-stat__value--pink" style={{ marginTop: 7 }}>{totals.unreviewed}</div>
        </div>
      </div>

      <div className="mg-table">
        <div className="mg-fleet__head">
          <span>REPOSITORY</span>
          <span className="mg-right">NODES</span>
          <span>COVERAGE</span>
          <span className="mg-right">SAVED</span>
          <span className="mg-right">UNREVIEWED</span>
        </div>
        {repos.map((r) => {
          const pct = Math.round(r.coverage * 100);
          return (
            <div key={r.name} className={`mg-fleet__row mg-row-hover${r.self ? " mg-fleet__row--self" : ""}`}>
              <div style={{ minWidth: 0 }}>
                <div className="mg-fleet__name">{r.name}</div>
                <div className="mg-fleet__stack">{r.stack}</div>
              </div>
              <span className="mg-fleet__num">{r.nodes}</span>
              <div className="mg-fleet__cov">
                <span className="mg-fleet__cov-rail">
                  <span
                    className={`mg-fleet__cov-bar${r.coverage < 0.5 ? " mg-fleet__cov-bar--low" : ""}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="mg-fleet__cov-pct">{pct}%</span>
              </div>
              <span className="mg-fleet__saved">{r.saved}</span>
              <span className={`mg-fleet__unrev${r.unreviewed > 12 ? " mg-fleet__unrev--hot" : ""}`}>{r.unreviewed}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
