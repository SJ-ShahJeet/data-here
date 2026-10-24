"use client";
import { KIND_COLOR } from "@/lib/v2/constants";
import type { Session } from "@/lib/v2/types";

interface SessionsProps {
  sessions: Session[];
  selected: number;
  onSelect: (i: number) => void;
}

export function Sessions({ sessions, selected, onSelect }: SessionsProps) {
  const cur = sessions[selected] ?? sessions[0];

  return (
    <div className="mg-sessions" data-testid="mg-sessions">
      <div className="mg-sessions__list">
        {sessions.map((x, i) => (
          <div
            key={x.id}
            className={`mg-session-row mg-row-hover${selected === i ? " mg-session-row--on" : ""}`}
            onClick={() => onSelect(i)}
          >
            <div className="mg-session-row__top">
              <span className="mg-session-row__id">{x.id}</span>
              <span className="mg-session-row__when">{x.when}</span>
            </div>
            <div className="mg-session-row__title">{x.title}</div>
            <div className="mg-session-row__counts">
              <span>{x.read} read</span>
              <span>{x.wrote} wrote</span>
              <span className={x.open.length ? "mg-session-row__open--some" : ""}>{x.open.length} open</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mg-session">
        <div>
          <div className="mg-session__ids">
            <span className="accent">{cur.id}</span>
            <span className="mg-session__stamp">{cur.stamp}</span>
          </div>
          <h2 className="mg-session__title">{cur.title}</h2>
          <p className="mg-session__summary">{cur.summary}</p>
        </div>

        <div className="mg-session__stats">
          <div className="mg-session__stat">
            <div className="mg-session__stat-label">Context injected</div>
            <div className="mg-session__stat-value">{cur.injected}</div>
          </div>
          <div className="mg-session__stat">
            <div className="mg-session__stat-label">Tokens saved</div>
            <div className="mg-session__stat-value accent">{cur.saved}</div>
          </div>
          <div className="mg-session__stat">
            <div className="mg-session__stat-label">Duration</div>
            <div className="mg-session__stat-value">{cur.duration}</div>
          </div>
        </div>

        <div data-tour="session" className="mg-session__cols">
          <div>
            <h3 className="mg-session__col-title">Read</h3>
            {cur.reads.map((r, i) => (
              <div key={i} className="mg-bullet">
                <span className="mg-dot" style={{ background: KIND_COLOR[r.kind] }} />
                <span className="mg-bullet__text">{r.text}</span>
              </div>
            ))}
          </div>
          <div>
            <h3 className="mg-session__col-title">Decided</h3>
            {cur.decided.map((d, i) => (
              <div key={i} className="mg-bullet">
                <span className="mg-dot" style={{ background: "var(--mg-ok)" }} />
                <span className="mg-bullet__text">{d}</span>
              </div>
            ))}
          </div>
          <div>
            <h3 className="mg-session__col-title mg-session__col-title--open">Left open</h3>
            {cur.open.map((o, i) => (
              <div key={i} className="mg-bullet">
                <span className="mg-dot" style={{ background: "var(--mg-pink)" }} />
                <span className="mg-bullet__text">{o}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
