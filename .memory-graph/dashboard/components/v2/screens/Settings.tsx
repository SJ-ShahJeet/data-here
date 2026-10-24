"use client";
import type { DashboardState } from "@/lib/v2/logic";
import { budgetLabel, injectedCount } from "@/lib/v2/logic";
import { KIND_COLOR, KINDS } from "@/lib/v2/constants";
import type { Budget, DashboardData, Decay, NodeKind, StackItem } from "@/lib/v2/types";

const BUDGETS: Budget[] = ["2k", "6k", "12k", "No cap"];
const DECAYS: [Decay, string][] = [
  ["Off", "weights never fall"],
  ["90 days", "slow — long-lived repos"],
  ["30 days", "balanced · default"],
  ["7 days", "aggressive — fast-moving code"],
];

interface SettingsProps {
  data: DashboardData;
  state: DashboardState;
  stack: StackItem[];
  onToggleStack: (name: string) => void;
  onEditor: () => void;
  onBudget: (b: Budget) => void;
  onToggleKind: (k: NodeKind) => void;
  onMinWeight: (v: number) => void;
  onMinWeightCommit: () => void;
  onDecay: (d: Decay) => void;
  onRescan: () => void;
  /** How many nodes the last brief actually injected; absent for sample data. */
  injectedCount?: number;
}

export function Settings({
  data, state: s, stack, onToggleStack, onEditor, onBudget, onToggleKind, onMinWeight, onMinWeightCommit, onDecay, onRescan, injectedCount: injectedCountProp,
}: SettingsProps) {
  const keptCount = data.proposals.length - Object.keys(s.dropped).length;
  const ownFactCount = s.ownFacts.filter((f) => f.text.trim()).length;
  const injected = injectedCount(data.nodeCount, Object.keys(s.kindsOff).length, s.minWeight);
  const summary =
    typeof injectedCountProp === "number"
      ? `${injectedCountProp} ${injectedCountProp === 1 ? "node was" : "nodes were"} injected into the last brief · about ${budgetLabel(s.budget)} tokens per session`
      : `${injected} of ${data.nodeCount} nodes clear these rules today · about ${budgetLabel(s.budget)} tokens per session`;

  return (
    <div className="mg-settings" data-testid="mg-settings">
      <div>
        <h3 className="mg-h3">Stack &amp; detected facts</h3>
        <p className="mg-settings__lead">Unchecking a technology stops its nodes being injected.</p>
        <div className="mg-chips">
          {stack.map((t) => {
            const on = !s.stackOff[t.name];
            return (
              <button
                key={t.name}
                type="button"
                className={`mg-chip${on ? "" : " mg-chip--off"}`}
                onClick={() => onToggleStack(t.name)}
                aria-pressed={on}
              >
                <span className="mg-dot" />
                {t.name}
              </button>
            );
          })}
        </div>
        <div className="mg-settings__foot">
          <span>
            {keptCount} facts confirmed during setup, {ownFactCount} added by hand
          </span>
          <button type="button" className="mg-link mg-link--accent" onClick={onEditor}>
            Edit in graph editor
          </button>
        </div>
      </div>

      <div data-tour="inject">
        <h3 className="mg-h3">Injection rules</h3>
        <p className="mg-settings__lead">What gets handed to the model at the start of a session.</p>
        <div style={{ borderTop: "1px solid var(--mg-t07)" }}>
          <div className="mg-rule-row">
            <div>
              <div className="mg-rule-row__name">Context budget</div>
              <div className="mg-rule-row__desc">Hard ceiling per session</div>
            </div>
            <div className="mg-pills">
              {BUDGETS.map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`mg-pill${s.budget === b ? " mg-pill--on" : ""}`}
                  onClick={() => onBudget(b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div className="mg-rule-row">
            <div>
              <div className="mg-rule-row__name">Node types injected</div>
              <div className="mg-rule-row__desc">Constraints are rarely worth excluding</div>
            </div>
            <div className="mg-pills">
              {KINDS.map((k) => {
                const on = !s.kindsOff[k];
                return (
                  <button
                    key={k}
                    type="button"
                    className={`mg-pill mg-pill--kind${on ? " mg-pill--on" : ""}`}
                    style={on ? { color: KIND_COLOR[k] } : undefined}
                    onClick={() => onToggleKind(k)}
                    aria-pressed={on}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mg-rule-row">
            <div>
              <div className="mg-rule-row__name">Minimum weight</div>
              <div className="mg-rule-row__desc">Nodes below this stay out of context</div>
            </div>
            <div className="mg-range">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={s.minWeight}
                onChange={(e) => onMinWeight(Number(e.target.value))}
                onPointerUp={onMinWeightCommit}
                onKeyUp={(e) => {
                  if (/^(Arrow(Left|Right|Up|Down)|Home|End|Page(Up|Down))$/.test(e.key)) onMinWeightCommit();
                }}
                aria-label="Minimum weight"
              />
              <span className="mg-range__value">{(s.minWeight / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="mg-note">{summary}</div>
      </div>

      <div>
        <h3 className="mg-h3">Decay</h3>
        <p className="mg-settings__lead">Faster decay keeps context current but forgets slow-moving truths.</p>
        <div className="mg-decays">
          {DECAYS.map(([label, note]) => (
            <button
              key={label}
              type="button"
              className={`mg-decay${s.decay === label ? " mg-decay--on" : ""}`}
              onClick={() => onDecay(label)}
            >
              <span className="mg-decay__label">{label}</span>
              <span className="mg-decay__note">{note}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mg-conn">
        <div>
          <h3 className="mg-h3">Connection</h3>
          <div className="mg-conn__line">{data.connection}</div>
        </div>
        <div className="mg-conn__actions">
          <button type="button" className="mg-outline mg-outline--accent-on" onClick={onRescan}>
            Re-scan
          </button>
          <button type="button" className="mg-outline mg-outline--danger">
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
