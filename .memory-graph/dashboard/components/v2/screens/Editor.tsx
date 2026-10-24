"use client";
import { KIND_COLOR } from "@/lib/v2/constants";
import type { EditorFilter, GraphNodeRow } from "@/lib/v2/types";

const FILTERS: EditorFilter[] = ["All", "Unreviewed", "Decision", "Constraint", "Open thread", "Dependency"];

interface EditorProps {
  nodes: GraphNodeRow[];
  filter: EditorFilter;
  selected: Record<string, true>;
  onFilter: (f: EditorFilter) => void;
  onToggle: (id: string) => void;
  onPin: () => void;
  onMerge: () => void;
  onPrune: () => void;
}

export function Editor({ nodes, filter, selected, onFilter, onToggle, onPin, onMerge, onPrune }: EditorProps) {
  const selCount = Object.keys(selected).length;

  return (
    <div className="mg-screen" data-testid="mg-editor">
      <div data-tour="editorbar" className="mg-editorbar">
        <div className="mg-filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`mg-filter${filter === f ? " mg-filter--on" : ""}`}
              onClick={() => onFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="mg-bulk">
          <span className={`mg-bulk__count${selCount ? " mg-bulk__count--some" : ""}`}>{selCount} selected</span>
          <div className={`mg-bulk__actions${selCount ? "" : " mg-bulk__actions--off"}`}>
            <button type="button" className="mg-outline mg-outline--accent" onClick={onPin}>Pin</button>
            <button type="button" className="mg-outline mg-outline--blue" onClick={onMerge}>Merge</button>
            <button type="button" className="mg-outline mg-outline--danger" onClick={onPrune}>Prune</button>
          </div>
        </div>
      </div>

      <div className="mg-table">
        <div className="mg-table__head">
          <span />
          <span>CLAIM</span>
          <span>TYPE</span>
          <span className="mg-right">WEIGHT</span>
          <span className="mg-right">SEEN</span>
          <span className="mg-right">STATUS</span>
        </div>
        {nodes.map((n) => {
          const on = !!selected[n.id];
          return (
            <div
              key={n.id}
              className={`mg-table__row mg-row-hover${on ? " mg-table__row--sel" : n.status === "stale" ? " mg-table__row--stale" : ""}`}
              data-testid="mg-node-row"
            >
              <button
                type="button"
                className={`mg-check${on ? " mg-check--on" : ""}`}
                onClick={() => onToggle(n.id)}
                aria-label={`Select ${n.claim}`}
                aria-pressed={on}
              >
                {on ? "✓" : ""}
              </button>
              <div style={{ minWidth: 0 }}>
                <div className="mg-table__claim">{n.claim}</div>
                <div className="mg-table__path">{n.path}</div>
              </div>
              <span className="mg-kind mg-table__kind" style={{ color: KIND_COLOR[n.kind] }}>{n.kind}</span>
              <div className="mg-table__weight">
                <span
                  className={`mg-table__weight-bar${n.weight < 0.4 ? " mg-table__weight-bar--low" : ""}`}
                  style={{ width: Math.round(n.weight * 40) }}
                />
                <span className="mg-table__weight-value">{n.weight.toFixed(2)}</span>
              </div>
              <span className="mg-table__seen">{n.seen}</span>
              <span className={`mg-table__status mg-status--${n.status}`}>{n.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
