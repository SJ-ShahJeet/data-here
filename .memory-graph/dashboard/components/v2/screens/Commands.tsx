"use client";
import type { CommandSection } from "@/lib/v2/types";

interface CommandsProps {
  sections: CommandSection[];
  copied: string;
  onCopy: (cmd: string) => void;
}

export function Commands({ sections, copied, onCopy }: CommandsProps) {
  return (
    <div className="mg-commands" data-testid="mg-commands">
      <p className="mg-commands__lead">
        Everything the dashboard does has a command behind it. Run them from the repo root unless a flag says otherwise.
      </p>
      {sections.map((sec) => (
        <div key={sec.title} className="mg-cmd-section">
          <div className="mg-cmd-section__head">
            <h3 className="mg-h3">{sec.title}</h3>
            <span className="mg-cmd-section__note">{sec.note}</span>
          </div>
          <div className="mg-cmd-section__list">
            {sec.items.map((c) => {
              const done = copied === c.cmd;
              return (
                <div key={c.cmd} className="mg-cmd mg-row-hover">
                  <div style={{ minWidth: 0 }}>
                    <div className="mg-cmd__cmd">{c.cmd}</div>
                    <div className="mg-cmd__desc">{c.desc}</div>
                    {c.flags && <div className="mg-cmd__flags">{c.flags}</div>}
                  </div>
                  <button
                    type="button"
                    className={`mg-cmd__copy${done ? " mg-cmd__copy--done" : ""}`}
                    onClick={() => onCopy(c.cmd)}
                  >
                    {done ? "copied" : "copy"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
