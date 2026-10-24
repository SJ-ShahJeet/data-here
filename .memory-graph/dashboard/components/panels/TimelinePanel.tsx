"use client";

import { useState } from "react";
import type { Sessions } from "@/lib/scan";

export function TimelinePanel({ data }: { data: Sessions }): React.JSX.Element {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (i: number) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <section data-testid="panel-timeline" data-severity="neutral" className="mg-panel">
      <div className="mg-panel-head">
        <h2>Session timeline</h2>
        <span className="mg-annot">— sessions/*.md</span>
      </div>

      {!data.present || data.items.length === 0 ? (
        <div className="card">
          <div className="card-title">No sessions yet</div>
          <p className="card-body" data-testid="panel-empty">
            No sessions recorded yet
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {data.items.map((item, idx) => (
            <div
              key={item.file}
              className="card mg-list-card"
              data-testid="timeline-item"
              style={{ cursor: "pointer" }}
              onClick={() => toggle(idx)}
            >
              <div
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13.5px" }}>{item.topics || item.file}</div>
                  <div className="mg-quiet" style={{ fontSize: "11.5px" }}>
                    {item.date}
                    {item.time ? ` ${item.time}` : ""}
                    {item.session != null ? ` · session ${item.session}` : ""} ·{" "}
                    {item.scope.length} files
                  </div>
                </div>
                {item.god_nodes_touched.length > 0 && (
                  <span className="tag tag-accent" style={{ fontSize: "10px", flex: "none" }}>
                    {item.god_nodes_touched[0]}
                  </span>
                )}
              </div>
              {expanded[idx] && (
                <div
                  style={{
                    padding: "0 var(--space-4) var(--space-4)",
                    borderTop: "1px solid var(--color-divider)",
                  }}
                >
                  {item.scope.length > 0 && (
                    <>
                      <div className="mg-section-label">Scope</div>
                      <div
                        className="mg-mono"
                        style={{
                          fontSize: "12px",
                          opacity: 0.8,
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                        }}
                      >
                        {item.scope.map((f) => (
                          <div key={f}>{f}</div>
                        ))}
                      </div>
                    </>
                  )}
                  {item.context && (
                    <>
                      <div className="mg-section-label">Context</div>
                      <p style={{ margin: 0, fontSize: "13px", opacity: 0.8 }}>{item.context}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
