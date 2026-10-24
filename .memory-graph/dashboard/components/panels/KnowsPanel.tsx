"use client";

import { useState } from "react";
import type { StateYaml } from "@/lib/scan";

export function KnowsPanel({ data }: { data: StateYaml }): React.JSX.Element {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const isEmpty =
    !data.present ||
    (data.open.length === 0 &&
      data.blocked.length === 0 &&
      data.god_nodes_recent.length === 0 &&
      data.recent_context.length === 0);

  const toggle = (i: number) => setChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <section data-testid="panel-knows" data-severity="neutral" className="mg-panel">
      <div className="mg-panel-head">
        <h2>What it knows now</h2>
        <span className="mg-annot">
          — memory/state.yaml{data.updated ? `, updated ${data.updated}` : ""}
        </span>
      </div>

      {isEmpty ? (
        <div className="card">
          <div className="card-title">No hot tier yet</div>
          <p className="card-body" data-testid="panel-empty">
            No memory yet — finish a session to populate state.yaml
          </p>
          <div className="card-meta">
            <code>bash setup --agent=all</code>
          </div>
        </div>
      ) : (
        <div>
          <div className="card mg-list-card" style={{ marginBottom: "var(--space-4)" }}>
            <div className="mg-list-head">Open ({data.open.length})</div>
            {data.open.map((text, i) => (
              <div key={i} className="mg-list-row" data-testid="knows-item">
                <button
                  type="button"
                  className="mg-check"
                  data-checked={checked[i] ? "true" : "false"}
                  aria-pressed={!!checked[i]}
                  onClick={() => toggle(i)}
                >
                  {checked[i] && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      aria-hidden="true"
                    >
                      <path d="M4 12l6 6L20 6" />
                    </svg>
                  )}
                </button>
                <span
                  style={{
                    flex: 1,
                    fontSize: "13.5px",
                    opacity: checked[i] ? 0.4 : 1,
                    textDecoration: checked[i] ? "line-through" : "none",
                  }}
                >
                  {text}
                </span>
              </div>
            ))}
            {data.open.length === 0 && <div className="mg-list-none">Nothing open.</div>}
          </div>

          <div className="card mg-list-card" style={{ marginBottom: "var(--space-4)" }}>
            <div className="mg-list-head">Blocked ({data.blocked.length})</div>
            {data.blocked.map((text, i) => (
              <div key={i} className="mg-list-row" data-testid="knows-item">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  style={{ flex: "none", opacity: 0.6 }}
                  aria-hidden="true"
                >
                  <path d="M12 4.5L20.5 19H3.5L12 4.5Z" />
                  <path d="M12 10v4" />
                </svg>
                <span style={{ flex: 1, fontSize: "13.5px" }}>{text}</span>
              </div>
            ))}
            {data.blocked.length === 0 && <div className="mg-list-none">Nothing blocked.</div>}
          </div>

          <div className="mg-grid-2">
            <div>
              <h5 style={{ opacity: 0.55, marginBottom: "var(--space-2)" }}>Recent context</h5>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "18px",
                  fontSize: "13px",
                  opacity: 0.85,
                  lineHeight: 1.7,
                }}
              >
                {data.recent_context.map((ctx, i) => (
                  <li key={i} data-testid="knows-item">
                    {ctx}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h5 style={{ opacity: 0.55, marginBottom: "var(--space-2)" }}>God nodes recent</h5>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {data.god_nodes_recent.map((node, i) => (
                  <span key={i} className="tag tag-accent" data-testid="knows-item">
                    {node}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
