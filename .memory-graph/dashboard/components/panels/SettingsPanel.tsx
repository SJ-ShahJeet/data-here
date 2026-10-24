"use client";

import { useState } from "react";
import type { Settings } from "@/lib/scan";

const COMMANDS = [
  { id: "graph-build", code: "python3 .memory-graph/engine/graph-build.py .", desc: "Rebuild the code graph", runnable: true },
  {
    id: "tokensavers",
    code: "bash scripts/enable-token-savers.sh",
    desc: "Agent brief + tool output compression",
    runnable: true,
  },
  {
    id: "ollama",
    code: "bash scripts/enable-semantic-ollama.sh",
    desc: "Local semantic compression",
    runnable: true,
  },
  {
    id: "check-ollama",
    code: "bash scripts/check-ollama.sh",
    desc: "Check local Ollama compression setup",
    runnable: true,
  },
  {
    id: "graph-scout-check",
    code: "bash scripts/check-graph-scout-local.sh",
    desc: "Check local graph scout setup",
    runnable: true,
  },
  {
    id: "graph-scout-enable",
    code: "bash scripts/enable-graph-scout-local.sh",
    desc: "Local graph traversal, no Cursor subagent tokens",
    runnable: true,
  },
  {
    id: "semantic-auto",
    code: "bash scripts/enable-semantic-auto.sh",
    desc: "Auto semantic-compress followup on memory caps",
    runnable: true,
  },
  {
    id: "token-first",
    code: "bash scripts/enable-token-first.sh",
    desc: "Token-first profile: context gateway, no scout auto-inject",
    runnable: true,
  },
  {
    id: "test-static",
    code: "bash scripts/test-static.sh",
    desc: "Fast static checks — required files, structure",
    runnable: true,
  },
];

type RunState = "running" | "done" | { error: string };

// The handful of keys someone actually glances at day to day. Everything
// else in DEFAULTS (mg-config.ts) is a tuning knob — thresholds, caps,
// per-feature toggles — and lives behind "Show advanced settings" instead
// of competing for attention in the same grid.
const BASIC_KEYS = ["profile", "track", "model", "host", "enabled"];

export function SettingsPanel({ data }: { data: Settings }): React.JSX.Element {
  const [copied, setCopied] = useState<string | null>(null);
  const [runState, setRunState] = useState<Record<string, RunState>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Edited-but-unsaved values, keyed by config key.
  const [edits, setEdits] = useState<Record<string, string>>({});
  // Values written by a previous successful save — .memory-graph/ isn't
  // watched by the SSE stream, so this is how the field keeps showing what
  // was actually saved instead of reverting to the stale prop.
  const [savedOverrides, setSavedOverrides] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"saving" | "done" | { error: string } | null>(null);
  const configKeys = Object.keys(data.config);
  const basicKeys = BASIC_KEYS.filter((k) => configKeys.includes(k));
  const advancedKeys = configKeys.filter((k) => !BASIC_KEYS.includes(k));
  const envKeys = Object.keys(data.env_overrides);
  const isEmpty = configKeys.length === 0;
  const dirtyCount = Object.keys(edits).length;

  const copy = (id: string, code: string) => {
    void navigator.clipboard?.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied((prev) => (prev === id ? null : prev)), 1400);
  };

  const effectiveValue = (key: string): string => savedOverrides[key] ?? String(data.config[key]);

  const onFieldChange = (key: string, value: string) => {
    setEdits((prev) => {
      const next = { ...prev };
      if (value === effectiveValue(key)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const saveChanges = async () => {
    if (dirtyCount === 0 || saveState === "saving") return;
    const changes = { ...edits };
    setSaveState("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const body = await res.json();
      if (body.ok) {
        setSavedOverrides((prev) => ({ ...prev, ...changes }));
        setEdits({});
        setSaveState("done");
        setTimeout(() => setSaveState((s) => (s === "done" ? null : s)), 2000);
      } else {
        setSaveState({ error: body.error || "save failed" });
        setTimeout(() => setSaveState((s) => (typeof s === "object" ? null : s)), 5000);
      }
    } catch (e) {
      setSaveState({ error: e instanceof Error ? e.message : "save failed" });
      setTimeout(() => setSaveState((s) => (typeof s === "object" ? null : s)), 5000);
    }
  };

  const renderField = (key: string) => {
    const curType = typeof data.config[key];
    const value = edits[key] ?? effectiveValue(key);
    return (
      <div className="field" key={key} data-testid="settings-row" data-key={key}>
        <label htmlFor={`cfg-${key}`}>{key}</label>
        {curType === "boolean" ? (
          <select
            id={`cfg-${key}`}
            className="input"
            value={value}
            onChange={(e) => onFieldChange(key, e.target.value)}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            id={`cfg-${key}`}
            className="input"
            type={curType === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => onFieldChange(key, e.target.value)}
          />
        )}
      </div>
    );
  };

  const clearRunState = (id: string, delayMs: number) => {
    setTimeout(() => {
      setRunState((prev) => {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      });
    }, delayMs);
  };

  const run = async (id: string) => {
    if (runState[id] === "running") return;
    setRunState((prev) => ({ ...prev, [id]: "running" }));
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await res.json();
      if (body.ok) {
        setRunState((prev) => ({ ...prev, [id]: "done" }));
        clearRunState(id, 2000);
      } else {
        setRunState((prev) => ({ ...prev, [id]: { error: body.error || "failed" } }));
        clearRunState(id, 5000);
      }
    } catch (e) {
      setRunState((prev) => ({
        ...prev,
        [id]: { error: e instanceof Error ? e.message : "failed" },
      }));
      clearRunState(id, 5000);
    }
  };

  return (
    <section data-testid="panel-settings" data-severity="neutral" className="card mg-panel">
      <div className="mg-panel-head">
        <h2>Settings &amp; commands</h2>
        <span className="mg-annot">
          — profile {data.profile} · track {data.track}
        </span>
      </div>

      {isEmpty ? (
        <p className="card-body" data-testid="panel-empty">
          No settings data
        </p>
      ) : (
        <>
          <div
            className="mg-grid-2"
            style={{ gap: "var(--space-4) var(--space-6)", marginBottom: "var(--space-5)" }}
          >
            {basicKeys.map((k) => renderField(k))}
            {envKeys.map((k) => (
              <div className="field" key={k} data-testid="settings-row" data-key={k}>
                <label>{k} (env override)</label>
                <div className="input" style={{ display: "flex", alignItems: "center" }}>
                  {data.env_overrides[k]}
                </div>
              </div>
            ))}
          </div>

          {advancedKeys.length > 0 && (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                data-testid="settings-advanced-toggle"
                style={{ fontSize: "12.5px", marginBottom: "var(--space-4)" }}
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Hide advanced settings" : "Show advanced settings"}
              </button>

              {showAdvanced && (
                <div
                  data-testid="settings-advanced"
                  className="mg-grid-2"
                  style={{
                    gap: "var(--space-4) var(--space-6)",
                    marginBottom: "var(--space-5)",
                    paddingTop: "var(--space-2)",
                    borderTop: "1px solid var(--color-divider)",
                  }}
                >
                  {advancedKeys.map((k) => renderField(k))}
                </div>
              )}
            </>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-5)",
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              data-testid="settings-save"
              style={{ fontSize: "15px", padding: "var(--space-3) calc(var(--space-4) * 1.2)", width: "100%" }}
              disabled={dirtyCount === 0 || saveState === "saving"}
              onClick={saveChanges}
            >
              {saveState === "saving"
                ? "Saving…"
                : saveState === "done"
                  ? "Saved ✓"
                  : `Save changes${dirtyCount ? ` (${dirtyCount})` : ""}`}
            </button>
            {saveState !== null && typeof saveState === "object" && (
              <span style={{ fontSize: "11.5px", color: "var(--color-accent)" }}>
                {saveState.error}
              </span>
            )}
          </div>
        </>
      )}

      <div className="mg-section-label" style={{ margin: "0 0 var(--space-2)" }}>
        Run
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {COMMANDS.map((cmd) => {
          const state = runState[cmd.id];
          const isError = typeof state === "object";
          return (
            <div key={cmd.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-3)",
                  border: `1px solid ${isError ? "var(--color-accent)" : "var(--color-divider)"}`,
                  borderRadius: "var(--radius-md)",
                }}
              >
                <code style={{ flex: 1, fontSize: "12.5px" }}>{cmd.code}</code>
                <span className="mg-quiet" style={{ fontSize: "11.5px" }}>{cmd.desc}</span>
                {cmd.runnable ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-testid="settings-run"
                    style={{ fontSize: "12px", padding: "4px 10px" }}
                    disabled={state === "running"}
                    onClick={() => run(cmd.id)}
                  >
                    {state === "running" ? "Running…" : state === "done" ? "Done ✓" : isError ? "Failed" : "Run"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: "12px", padding: "4px 10px" }}
                    onClick={() => copy(cmd.id, cmd.code)}
                  >
                    {copied === cmd.id ? "Copied ✓" : "Copy"}
                  </button>
                )}
              </div>
              {isError && (
                <p
                  style={{
                    margin: "var(--space-1) 0 0",
                    fontSize: "11.5px",
                    color: "var(--color-accent)",
                    opacity: 0.85,
                  }}
                >
                  {(state as { error: string }).error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
