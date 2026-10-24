"use client";

import { useState, useMemo } from "react";
import type { Graph } from "@/lib/scan";
import { useMotionSafe } from "@/hooks/useMotionSafe";

const COMMUNITY_RAMP = [
  "var(--color-accent-400)",
  "var(--color-accent-500)",
  "var(--color-accent-600)",
  "var(--color-accent-700)",
];

const ACCENT_TINT = "color-mix(in srgb, var(--color-accent) 14%, transparent)";

export function GraphPanel({ data }: { data: Graph }): React.JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  useMotionSafe();

  // Build neighbour map
  const neighbours = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const node of data.nodes) {
      map.set(node.id, new Set([node.id]));
    }
    for (const link of data.links) {
      map.get(link.source)?.add(link.target);
      map.get(link.target)?.add(link.source);
    }
    return map;
  }, [data.nodes, data.links]);

  const types = useMemo(
    () => Array.from(new Set(data.nodes.map((n) => n.type))).sort(),
    [data.nodes]
  );
  const communities = useMemo(
    () =>
      Array.from(
        new Set(data.nodes.map((n) => String(n.community ?? "—")))
      ).sort(),
    [data.nodes]
  );
  const communityColor = (c: unknown): string => {
    const idx = communities.indexOf(String(c ?? "—"));
    return COMMUNITY_RAMP[((idx % COMMUNITY_RAMP.length) + COMMUNITY_RAMP.length) % COMMUNITY_RAMP.length];
  };

  const visible = data.nodes.filter(
    (n) =>
      (!typeFilter || n.type === typeFilter) &&
      (communityFilter === "all" || String(n.community ?? "—") === communityFilter)
  );

  const selectedNode = data.nodes.find((n) => n.id === selected) ?? null;
  const neighbourChips = selectedNode
    ? data.nodes.filter(
        (n) => n.id !== selectedNode.id && neighbours.get(selectedNode.id)?.has(n.id)
      )
    : [];

  return (
    <section data-testid="panel-graph" data-severity="neutral" className="card mg-panel">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "var(--space-3)",
        }}
      >
        <div>
          <h2>Code graph</h2>
          <span className="mg-annot">— graphify-out/graph.json</span>
        </div>
        {data.present && data.nodes.length > 0 && (
          <div className="mg-quiet" style={{ fontSize: "12px" }}>
            showing {visible.length} of {data.node_count.toLocaleString("en-US")} nodes
          </div>
        )}
      </div>

      {!data.present || data.nodes.length === 0 ? (
        <div>
          <p className="card-body" data-testid="panel-empty">
            No graph built — run /graphify . once
          </p>
          <div className="card-meta">
            <code>/graphify .</code>
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-4)",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "12px", opacity: 0.55 }}>Type</span>
            {types.map((t) => {
              const active = typeFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  className="tag"
                  onClick={() => setTypeFilter(active ? null : t)}
                  style={{
                    cursor: "pointer",
                    border: `1px solid ${active ? "var(--color-accent)" : "transparent"}`,
                    background: active ? ACCENT_TINT : "var(--color-neutral-800)",
                    color: active ? "var(--color-accent)" : "var(--color-neutral-100)",
                  }}
                >
                  {t}
                </button>
              );
            })}
            {communities.length > 1 && (
              <>
                <span
                  style={{ width: "1px", height: "16px", background: "var(--color-divider)" }}
                />
                <span style={{ fontSize: "12px", opacity: 0.55 }}>Community</span>
                <div className="seg" role="radiogroup">
                  {["all", ...communities].map((c) => (
                    <label
                      key={c}
                      className="seg-opt"
                      data-active={communityFilter === c ? "true" : "false"}
                    >
                      <input
                        type="radio"
                        name="community"
                        style={{
                          position: "absolute",
                          opacity: 0,
                          width: 0,
                          height: 0,
                          pointerEvents: "none",
                        }}
                        checked={communityFilter === c}
                        onChange={() => setCommunityFilter(c)}
                      />
                      {c === "all" ? "All" : `C${c}`}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <table className="table" style={{ marginBottom: "var(--space-4)" }}>
            <thead>
              <tr>
                <th>Node</th>
                <th>Type</th>
                <th>Community</th>
                <th>Betweenness</th>
                <th>Degree</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((node) => {
                const isDimmed = hovered !== null && !neighbours.get(hovered)?.has(node.id);
                return (
                  <tr
                    key={node.id}
                    data-testid="graph-row"
                    data-node-id={node.id}
                    data-dimmed={isDimmed ? "true" : "false"}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setSelected(node.id)}
                    style={{
                      cursor: "pointer",
                      backgroundColor: selected === node.id ? ACCENT_TINT : undefined,
                    }}
                  >
                    <td className="mg-mono">{node.label}</td>
                    <td className="text-muted">{node.type}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          background: communityColor(node.community),
                        }}
                        title={String(node.community ?? "—")}
                      />
                    </td>
                    <td>{node.betweenness != null ? node.betweenness.toFixed(3) : "—"}</td>
                    <td className="text-muted">{node.degree}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {selectedNode && (
            <div
              style={{
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-bg)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-divider)",
              }}
            >
              <div style={{ fontSize: "13px", marginBottom: "var(--space-2)" }}>
                Selected: <strong>{selectedNode.label}</strong>
              </div>
              <div className="mg-quiet" style={{ fontSize: "12px", marginBottom: "var(--space-2)" }}>
                {neighbourChips.length} of {selectedNode.degree} connections.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {neighbourChips.map((n) => (
                  <span
                    key={n.id}
                    className="tag tag-neutral mg-mono"
                    style={{ fontSize: "11.5px" }}
                  >
                    {n.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
