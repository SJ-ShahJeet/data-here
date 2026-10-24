"use client";
import { halvedNote, sessionMeta, sparkHeights } from "@/lib/v2/logic";
import { KIND_COLOR } from "@/lib/v2/constants";
import type { DashboardData, QueueItem } from "@/lib/v2/types";

interface OverviewProps {
  data: DashboardData;
  queue: QueueItem[];
  queueIndex: number;
  onFocus: (i: number) => void;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onOpenEditor: () => void;
  onOpenSessions: () => void;
  onOpenSession: (i: number) => void;
}

export function Overview({
  data, queue, queueIndex, onFocus, onConfirm, onReject, onOpenEditor, onOpenSessions, onOpenSession,
}: OverviewProps) {
  const kindTotal = data.kinds.reduce((n, k) => n + k.count, 0);

  return (
    <div className="mg-screen" data-testid="mg-overview">
      <div data-tour="stats" className="mg-stats">
        {data.metrics.map((m) => {
          const bars = sparkHeights(m.spark);
          return (
            <div key={m.label} className="mg-stat">
              <div className="mg-stat__label">{m.label}</div>
              <div className="mg-stat__row">
                <span className={`mg-stat__value${m.accent ? " mg-stat__value--accent" : ""}`}>{m.value}</span>
                <span className="mg-spark" aria-hidden="true">
                  {bars.map((h, i) => (
                    <span
                      key={i}
                      className={`mg-spark__bar${i === bars.length - 1 ? " mg-spark__bar--last" : ""}`}
                      style={{ height: h }}
                    />
                  ))}
                </span>
              </div>
              <div className="mg-stat__note">{m.note}</div>
            </div>
          );
        })}
      </div>

      <div data-tour="queue" className="mg-section">
        <div className="mg-section__head">
          <div className="mg-section__title">
            <h2 className="mg-h2">Needs review</h2>
            <span className="mg-sub">{queue.length} written by a run, never confirmed</span>
          </div>
          <div className="mg-keys">
            <span>J K move</span>
            <span>C confirm</span>
            <span>R reject</span>
          </div>
        </div>
        <div className="mg-rule">
          {queue.map((q, i) => (
            <div
              key={q.id}
              className={`mg-queue-row${i === queueIndex ? " mg-queue-row--focus" : ""}`}
              onClick={() => onFocus(i)}
              data-testid="mg-queue-row"
            >
              <div className="mg-queue-row__body">
                <div className="mg-queue-row__meta">
                  <span className="mg-kind" style={{ color: KIND_COLOR[q.kind] }}>{q.kind}</span>
                  <span className="mg-queue-row__age">{q.meta}</span>
                </div>
                <div className="mg-queue-row__claim">{q.claim}</div>
                <div className="mg-queue-row__source">{q.source}</div>
              </div>
              <div className="mg-queue-row__actions">
                <button type="button" className="mg-outline mg-outline--ok" onClick={() => onConfirm(q.id)}>
                  Confirm
                </button>
                <button type="button" className="mg-outline mg-outline--danger" onClick={() => onReject(q.id)}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mg-two">
        <div data-tour="weights">
          <div className="mg-section__head" style={{ alignItems: "baseline" }}>
            <h2 className="mg-h2">Node weight</h2>
            <span className="mg-keys">tick marks 30d ago</span>
          </div>
          <div className="mg-rule">
            {data.weights.map((w) => (
              <div
                key={w.label}
                className={`mg-weight-row mg-row-hover${w.now < 0.4 ? " mg-weight-row--low" : ""}`}
                onClick={onOpenEditor}
              >
                <div className="mg-weight-row__label">
                  <span className="mg-weight-row__name">{w.label}</span>
                  <span className="mg-weight-row__kind" style={{ color: KIND_COLOR[w.kind] }}>{w.kind}</span>
                </div>
                <div className="mg-weight-row__track" aria-hidden="true">
                  <div className="mg-weight-row__rail" />
                  <div className="mg-weight-row__bar" style={{ width: `${w.now * 100}%` }} />
                  <div className="mg-weight-row__tick" style={{ left: `${w.then * 100}%` }} />
                </div>
                <div className="mg-weight-row__value">{w.now.toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="mg-note">{halvedNote(data.weights)}</div>
        </div>

        <div className="mg-two__side">
          <div>
            <h2 className="mg-h2" style={{ marginBottom: 11 }}>Composition</h2>
            <div className="mg-comp" aria-hidden="true">
              {data.kinds.map((k) => (
                <div
                  key={k.kind}
                  style={{ width: `${Math.round((k.count / kindTotal) * 100)}%`, background: KIND_COLOR[k.kind] }}
                />
              ))}
            </div>
            {data.kinds.map((k) => (
              <div key={k.kind} className="mg-comp-row">
                <span className="mg-dot" style={{ background: KIND_COLOR[k.kind] }} />
                <span className="mg-comp-row__label">{k.kind}</span>
                <span className="mg-comp-row__count">{k.count}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="mg-section__head" style={{ alignItems: "baseline", marginBottom: 11 }}>
              <h2 className="mg-h2">Recent sessions</h2>
              <button type="button" className="mg-link mg-link--accent" style={{ padding: 0, fontSize: 12 }} onClick={onOpenSessions}>
                All
              </button>
            </div>
            <div style={{ borderTop: "1px solid var(--mg-t07)" }}>
              {data.sessions.slice(0, 4).map((x, i) => (
                <div key={x.id} className="mg-recent-row mg-row-hover" onClick={() => onOpenSession(i)}>
                  <div style={{ minWidth: 0 }}>
                    <div className="mg-recent-row__title">{x.title}</div>
                    <div className="mg-recent-row__meta">{sessionMeta(data, i)}</div>
                  </div>
                  <span className="mg-recent-row__delta">+{x.wrote}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
