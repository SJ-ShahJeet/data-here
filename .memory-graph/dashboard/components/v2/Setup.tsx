"use client";
import type { DashboardState } from "@/lib/v2/logic";
import { nextLabel, setupHint } from "@/lib/v2/logic";
import { KIND_COLOR, KINDS } from "@/lib/v2/constants";
import type { DashboardData, NodeKind, StackItem } from "@/lib/v2/types";

const STEPS = ["Scan", "Stack", "Review", "Your facts"];

export interface SetupActions {
  exit: () => void;
  back: () => void;
  next: () => void;
  toggleStack: (name: string) => void;
  setStackDraft: (v: string) => void;
  addStack: () => void;
  toggleProposal: (i: number) => void;
  setFactKind: (i: number, kind: NodeKind) => void;
  setFactText: (i: number, text: string) => void;
  removeFact: (i: number) => void;
  addFact: () => void;
}

interface SetupProps {
  data: DashboardData;
  state: DashboardState;
  stack: StackItem[];
  actions: SetupActions;
}

export function Setup({ data, state: s, stack, actions }: SetupProps) {
  const scanDone = s.scanLines >= data.scan.length;
  const stackOnCount = stack.filter((t) => !s.stackOff[t.name]).length;
  const keptCount = data.proposals.length - Object.keys(s.dropped).length;
  const visibleScan = data.scan.slice(0, s.scanLines);

  return (
    <div className="mg-setup" data-testid="mg-setup">
      <div className="mg-setup__top">
        <div className="mg-brand">
          <span className="mg-brand__dot" />
          <span className="mg-brand__name">Memory Graph</span>
          <span className="mg-brand__path">please/setup</span>
        </div>
        <button type="button" className="mg-link" onClick={actions.exit}>
          Skip
        </button>
      </div>

      <div className="mg-setup__steps">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`mg-step${i === s.setupStep ? " mg-step--now" : i < s.setupStep ? " mg-step--done" : ""}`}
          >
            <span className="mg-step__n">{i + 1}</span>
            <span className="mg-step__label">{label}</span>
            <span className="mg-step__line" />
          </div>
        ))}
      </div>

      {s.setupStep === 0 && (
        <div className="mg-setup__body">
          <h2 className="mg-setup__title">Reading the repository</h2>
          <p className="mg-setup__lead">Nothing leaves your machine. You confirm everything on the next two screens.</p>
          <div className="mg-term">
            <div className="mg-term__bar">
              <span>memgraph init --scan</span>
              <span className={scanDone ? "mg-term__line--ok" : "accent"}>
                {scanDone ? `done · ${data.scanDuration}` : "reading…"}
              </span>
            </div>
            <div className="mg-term__body">
              {visibleScan.map((l, i) => (
                <div key={i} className={`mg-term__line${l.tone ? ` mg-term__line--${l.tone}` : ""}`}>
                  {l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {s.setupStep === 1 && (
        <div className="mg-setup__body">
          <h2 className="mg-setup__title">Confirm the stack</h2>
          <p className="mg-setup__lead">Detected from files in the repo. Uncheck anything that isn&apos;t really in use.</p>
          <div className="mg-list">
            {stack.map((t) => {
              const on = !s.stackOff[t.name];
              return (
                <div
                  key={t.name}
                  className={`mg-tick-row mg-row-hover${on ? "" : " mg-tick-row--off"}`}
                  onClick={() => actions.toggleStack(t.name)}
                >
                  <span className={`mg-check${on ? " mg-check--on" : ""}`}>{on ? "✓" : ""}</span>
                  <span className="mg-tick-row__name">{t.name}</span>
                  <span className="mg-tick-row__evidence">{t.evidence}</span>
                </div>
              );
            })}
          </div>
          <div className="mg-add-row">
            <input
              className="mg-input"
              value={s.stackDraft}
              onChange={(e) => actions.setStackDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") actions.addStack();
              }}
              placeholder="Add something it missed"
            />
            <button type="button" className="mg-outline mg-outline--accent" onClick={actions.addStack}>
              Add
            </button>
          </div>
        </div>
      )}

      {s.setupStep === 2 && (
        <div className="mg-setup__body">
          <div className="mg-setup__head">
            <h2 className="mg-setup__title">Review what it found</h2>
            <span className="mg-setup__count">
              {keptCount}/{data.proposals.length}
            </span>
          </div>
          <p className="mg-setup__lead">Constraints from code, conventions from commit history. Uncheck what&apos;s wrong.</p>
          <div className="mg-list">
            {data.proposals.map((p, i) => {
              const on = !s.dropped[i];
              return (
                <div
                  key={i}
                  className={`mg-tick-row mg-tick-row--top mg-row-hover${on ? "" : " mg-tick-row--off"}`}
                  onClick={() => actions.toggleProposal(i)}
                >
                  <span className={`mg-check${on ? " mg-check--on" : ""}`}>{on ? "✓" : ""}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="mg-tick-row__claim">{p.claim}</span>
                    <span className="mg-tick-row__proof">{p.evidence}</span>
                  </span>
                  <span className="mg-kind mg-tick-row__kind" style={{ color: KIND_COLOR[p.kind] }}>
                    {p.kind}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {s.setupStep === 3 && (
        <div className="mg-setup__body">
          <h2 className="mg-setup__title">Add what it couldn&apos;t infer</h2>
          <p className="mg-setup__lead">The things a new engineer keeps re-learning and no file records.</p>
          <div className="mg-facts">
            {s.ownFacts.map((f, i) => (
              <div key={i} className="mg-fact">
                <select
                  className="mg-select"
                  value={f.kind}
                  onChange={(e) => actions.setFactKind(i, e.target.value as NodeKind)}
                  aria-label="Fact kind"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <input
                  className="mg-input"
                  value={f.text}
                  onChange={(e) => actions.setFactText(i, e.target.value)}
                  placeholder="staging shares the prod VPC — never run destroy there"
                  aria-label="Fact"
                />
                <button type="button" className="mg-fact__x" onClick={() => actions.removeFact(i)} aria-label="Remove fact">
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="mg-dashed" onClick={actions.addFact}>
            Another fact
          </button>
        </div>
      )}

      <div className="mg-setup__foot">
        <button type="button" className={`mg-ghost${s.setupStep === 0 ? " mg-ghost--off" : ""}`} onClick={actions.back}>
          Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="mg-setup__hint">
            {setupHint(s.setupStep, scanDone, stackOnCount, keptCount, data.proposals.length)}
          </span>
          <button
            type="button"
            className={`mg-primary${s.setupStep === 0 && !scanDone ? " mg-primary--muted" : ""}`}
            onClick={actions.next}
          >
            {nextLabel(s.setupStep, scanDone)}
          </button>
        </div>
      </div>
    </div>
  );
}
