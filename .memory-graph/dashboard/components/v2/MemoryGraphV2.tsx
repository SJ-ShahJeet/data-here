"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardState, PaletteEntry, Rect } from "@/lib/v2/logic";
import {
  SCREEN_TITLES,
  TOUR_SEEN_KEY,
  budgetTokens,
  clampCursor,
  decayDays,
  filterPalette,
  initialState,
  injectToState,
  liveQueue,
  mergePlan,
  pluralNodes,
  sameRect,
  toggleKey,
  visibleNodes,
} from "@/lib/v2/logic";
import { ACCENT, KINDS } from "@/lib/v2/constants";
import { SAMPLE } from "@/lib/v2/sample";
import type { Budget, DashboardData, Decay, NodeAction, NodeKind, Screen, Window } from "@/lib/v2/types";
import { Palette } from "./Palette";
import { Setup } from "./Setup";
import { Sidebar } from "./Sidebar";
import { Toast } from "./Toast";
import { Tour } from "./Tour";
import { Commands } from "./screens/Commands";
import { Editor } from "./screens/Editor";
import { Fleet } from "./screens/Fleet";
import { Overview } from "./screens/Overview";
import { Sessions } from "./screens/Sessions";
import { Settings } from "./screens/Settings";

const WINDOWS: Window[] = ["7d", "30d", "90d"];
const SCAN_TICK_MS = 170;
const TOAST_MS = 2600;
const COPIED_MS = 1400;

/** Human-readable text from a rejected write, for the "Could not save" toast. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface MemoryGraphV2Props {
  data?: DashboardData;
  /** Highlight colour. Defaults to the design's amber. */
  accentColor?: string;
  /** Open the guided tour on first visit (persisted in localStorage). */
  tour?: boolean;
  /** Writes a review action for the given node ids. Without it, actions apply in memory only. */
  onNodes?: (action: NodeAction, ids: string[]) => Promise<void>;
  /** Writes a settings change (config key → new value). Without it, changes apply in memory only. */
  onSettings?: (changes: Record<string, string>) => Promise<void>;
}

export function MemoryGraphV2({ data = SAMPLE, accentColor = ACCENT, tour = true, onNodes, onSettings }: MemoryGraphV2Props) {
  const [s, setState] = useState<DashboardState>(() => initialState(data.inject));
  const set = useCallback(
    (patch: Partial<DashboardState> | ((p: DashboardState) => Partial<DashboardState>)) =>
      setState((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) })),
    [],
  );

  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tourRaf = useRef(0);
  const stateRef = useRef(s);
  stateRef.current = s;
  const dataRef = useRef(data);
  dataRef.current = data;
  const inFlight = useRef(false);

  // Re-seed the injection controls whenever fresh settings arrive from the
  // server (a new `data` after a write), so the screen reflects what was
  // actually saved rather than what was last typed.
  useEffect(() => {
    if (!data.inject) return;
    set(injectToState(data.inject));
  }, [data.inject, set]);

  // ---- derived ----
  const stack = useMemo(() => data.stack.concat(s.stackExtra), [data.stack, s.stackExtra]);
  const queue = useMemo(() => liveQueue(data.queue, s.resolved), [data.queue, s.resolved]);
  const queueIndex = clampCursor(s.queueIndex, queue.length);
  const nodes = useMemo(() => visibleNodes(data.nodes, s), [data.nodes, s]);

  // ---- helpers ----
  const flash = useCallback(
    (msg: string) => {
      set({ toast: msg });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => set({ toast: "" }), TOAST_MS);
    },
    [set],
  );

  const startScan = useCallback(() => {
    if (scanTimer.current) clearInterval(scanTimer.current);
    scanTimer.current = setInterval(() => {
      setState((p) => {
        const n = p.scanLines + 1;
        if (n >= data.scan.length && scanTimer.current) clearInterval(scanTimer.current);
        return { ...p, scanLines: n };
      });
    }, SCAN_TICK_MS);
  }, [data.scan.length]);

  const go = useCallback(
    (screen: Screen) => {
      if (screen === "setup") {
        set({ screen, setupStep: 0, scanLines: 0 });
        startScan();
      } else {
        set({ screen });
      }
    },
    [set, startScan],
  );

  /**
   * Runs a node action. With `onNodes` wired (live mode), the write happens
   * first and only its success runs `liveApply` — the row itself stays as-is
   * until fresh data arrives. Without it (sample mode), the change applies
   * to local state right away. Either way a failed write only shows a toast.
   */
  const act = useCallback(
    (ids: string[], action: NodeAction, sampleApply: () => void, liveApply: () => void, msg: string) => {
      if (!onNodes) {
        sampleApply();
        flash(msg);
        return;
      }
      // One write at a time: a held-down key must not queue duplicate POSTs.
      if (inFlight.current) return;
      inFlight.current = true;
      onNodes(action, ids)
        .then(
          () => {
            liveApply();
            flash(msg);
          },
          (err: unknown) => flash(`Could not save — ${errorMessage(err)}`),
        )
        .finally(() => {
          inFlight.current = false;
        });
    },
    [onNodes, flash],
  );

  const resolve = useCallback(
    (id: string, how: "confirmed" | "rejected") => {
      act(
        [id],
        how === "confirmed" ? "confirm" : "reject",
        () => set((p) => ({ resolved: { ...p.resolved, [id]: how }, queueIndex: 0 })),
        () => {},
        how === "confirmed" ? "Confirmed — weight locked at its current value." : "Rejected — it will not be injected again.",
      );
    },
    [act, set],
  );

  /** Writes a settings change when there is somewhere to write it. */
  const writeSetting = useCallback(
    (changes: Record<string, string>) => {
      onSettings?.(changes).catch((err: unknown) => {
        // The pill changed optimistically; put it back to what the server has.
        set(injectToState(dataRef.current.inject));
        flash(`Could not save — ${errorMessage(err)}`);
      });
    },
    [onSettings, flash, set],
  );

  const setBudget = useCallback(
    (budget: Budget) => {
      set({ budget });
      writeSetting({ inject_budget_tokens: budgetTokens(budget) });
    },
    [set, writeSetting],
  );
  const setDecay = useCallback(
    (decay: Decay) => {
      set({ decay });
      writeSetting({ decay_half_life_days: decayDays(decay) });
    },
    [set, writeSetting],
  );
  const toggleKind = useCallback(
    (k: NodeKind) => {
      const kindsOff = toggleKey(stateRef.current.kindsOff, k);
      set({ kindsOff });
      // An empty list means "all kinds" to the engine, so turning off the
      // last one still writes every kind rather than an empty string.
      const on = KINDS.filter((kind) => !kindsOff[kind]);
      writeSetting({ inject_kinds: (on.length ? on : KINDS).join(",") });
    },
    [set, writeSetting],
  );
  const onMinWeight = useCallback((minWeight: number) => set({ minWeight }), [set]);
  const onMinWeightCommit = useCallback(() => {
    writeSetting({ inject_min_weight: String(Math.round(stateRef.current.minWeight) / 100) });
  }, [writeSetting]);

  const endTour = useCallback(() => {
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
    } catch {
      /* private mode */
    }
    cancelAnimationFrame(tourRaf.current);
    set({ tourOpen: false, rect: null });
  }, [set]);

  const openTour = useCallback(
    () => set({ tourOpen: true, tourStep: 0, screen: data.tour[0].screen, rect: null }),
    [set, data.tour],
  );

  // ---- tour: measure the ringed element and follow scroll ----
  const measure = useCallback(() => {
    const st = data.tour[stateRef.current.tourStep];
    if (!st) return;
    const el = st.target ? document.querySelector(`[data-tour="${st.target}"]`) : null;
    const r = el?.getBoundingClientRect();
    const box: Rect | null = r ? { t: r.top, l: r.left, w: r.width, h: r.height } : null;
    if (!sameRect(box, stateRef.current.rect)) set({ rect: box });
  }, [data.tour, set]);

  const trackScroll = useCallback(() => {
    cancelAnimationFrame(tourRaf.current);
    let last: number | null = null;
    let still = 0;
    const tick = () => {
      if (!stateRef.current.tourOpen) return;
      measure();
      const y = window.scrollY;
      still = last !== null && Math.abs(y - last) < 0.5 ? still + 1 : 0;
      last = y;
      if (still < 4) tourRaf.current = requestAnimationFrame(tick);
    };
    tourRaf.current = requestAnimationFrame(tick);
  }, [measure]);

  useEffect(() => {
    if (!s.tourOpen) return;
    const st = data.tour[s.tourStep];
    if (!st) return;
    const el = st.target ? document.querySelector(`[data-tour="${st.target}"]`) : null;
    const top = el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - 150) : 0;
    window.scrollTo({ top, behavior: "smooth" });
    trackScroll();
    return () => cancelAnimationFrame(tourRaf.current);
  }, [s.tourOpen, s.tourStep, s.screen, data.tour, trackScroll]);

  useEffect(() => {
    const onMove = () => stateRef.current.tourOpen && measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, { passive: true });
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove);
    };
  }, [measure]);

  // First visit: open the tour once the client has mounted (localStorage is
  // not available during server render).
  useEffect(() => {
    if (!tour) return;
    let seen = false;
    try {
      seen = localStorage.getItem(TOUR_SEEN_KEY) === "1";
    } catch {
      /* private mode */
    }
    if (!seen) openTour();
  }, [tour, openTour]);

  useEffect(
    () => () => {
      if (scanTimer.current) clearInterval(scanTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      cancelAnimationFrame(tourRaf.current);
    },
    [],
  );

  // ---- palette ----
  const paletteEntries = useMemo<PaletteEntry[]>(
    () => [
      { group: "Go", label: "Overview", hint: "", run: () => go("overview") },
      { group: "Go", label: "Sessions", hint: "", run: () => go("sessions") },
      { group: "Go", label: "Graph editor", hint: "", run: () => go("editor") },
      { group: "Go", label: "Fleet", hint: "", run: () => go("fleet") },
      { group: "Go", label: "Commands", hint: "", run: () => go("commands") },
      { group: "Go", label: "Settings", hint: "", run: () => go("settings") },
      { group: "Run", label: "Re-scan repository", hint: "setup", run: () => go("setup") },
      { group: "Run", label: "Restart guided demo", hint: "tour", run: openTour },
      {
        group: "Run", label: "Confirm all unreviewed nodes", hint: "",
        run: () => {
          const live = liveQueue(data.queue, stateRef.current.resolved);
          if (!live.length) { flash("Nothing left to review."); return; }
          act(
            live.map((q) => q.id),
            "confirm",
            () => set((p) => {
              const next = { ...p.resolved };
              live.forEach((q) => { next[q.id] = "confirmed"; });
              return { resolved: next };
            }),
            () => {},
            "All unreviewed nodes confirmed.",
          );
        },
      },
      { group: "Run", label: "Clear selection", hint: "", run: () => set({ selected: {} }) },
      { group: "Filter", label: "Show unreviewed only", hint: "editor", run: () => set({ screen: "editor", filter: "Unreviewed" }) },
      { group: "Filter", label: "Show constraints", hint: "editor", run: () => set({ screen: "editor", filter: "Constraint" }) },
      { group: "Filter", label: "Show open threads", hint: "editor", run: () => set({ screen: "editor", filter: "Open thread" }) },
      { group: "Set", label: "Context budget 12k", hint: "settings", run: () => { set({ screen: "settings" }); setBudget("12k"); } },
      { group: "Set", label: "Decay half-life 7 days", hint: "settings", run: () => { set({ screen: "settings" }); setDecay("7 days"); } },
    ],
    [go, openTour, set, flash, act, setBudget, setDecay, data.queue],
  );
  const paletteItems = useMemo(() => filterPalette(paletteEntries, s.paletteQuery), [paletteEntries, s.paletteQuery]);
  const paletteItemsRef = useRef(paletteItems);
  paletteItemsRef.current = paletteItems;

  const runPalette = useCallback(
    (entry: PaletteEntry) => {
      set({ paletteOpen: false });
      entry.run();
    },
    [set],
  );

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = stateRef.current;
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        set({ paletteOpen: !st.paletteOpen, paletteQuery: "", paletteIndex: 0 });
        return;
      }
      if (st.paletteOpen) {
        const items = paletteItemsRef.current;
        if (e.key === "Escape") { e.preventDefault(); set({ paletteOpen: false }); }
        else if (e.key === "ArrowDown") { e.preventDefault(); set({ paletteIndex: Math.min(items.length - 1, st.paletteIndex + 1) }); }
        else if (e.key === "ArrowUp") { e.preventDefault(); set({ paletteIndex: Math.max(0, st.paletteIndex - 1) }); }
        else if (e.key === "Enter") { e.preventDefault(); const it = items[st.paletteIndex]; if (it) runPalette(it); }
        return;
      }
      if (typing) return;
      if (e.key === "Escape" && st.tourOpen) { endTour(); return; }

      if (st.screen === "overview") {
        const live = liveQueue(data.queue, st.resolved);
        if (!live.length) return;
        const i = clampCursor(st.queueIndex, live.length);
        if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); set({ queueIndex: Math.min(live.length - 1, i + 1) }); }
        else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); set({ queueIndex: Math.max(0, i - 1) }); }
        else if (e.key === "c") resolve(live[i].id, "confirmed");
        else if (e.key === "r") resolve(live[i].id, "rejected");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data.queue, set, resolve, endTour, runPalette]);

  // ---- editor bulk actions ----
  // Rows are selected by id, which is also what the store is addressed by.
  const bulkPin = () => {
    const ids = Object.keys(s.selected);
    if (!ids.length) return;
    act(
      ids,
      "pin",
      () => set((p) => {
        const next = { ...p.nodeStatus };
        ids.forEach((id) => { next[id] = "pinned"; });
        return { nodeStatus: next, selected: {} };
      }),
      () => set({ selected: {} }),
      `${pluralNodes(ids.length, "pinned.")} Always injected.`,
    );
  };
  const bulkMerge = () => {
    const plan = mergePlan(data.nodes, s.selected);
    if (!plan) { flash("Merging needs two or more rows."); return; }
    const keepClaim = data.nodes.find((n) => n.id === plan.keep)?.claim ?? plan.keep;
    act(
      [plan.keep, ...plan.fold],
      "merge",
      () => set((p) => {
        const next = { ...p.pruned };
        plan.fold.forEach((id) => { next[id] = true; });
        return { pruned: next, selected: {} };
      }),
      () => set({ selected: {} }),
      `${plan.fold.length + 1} nodes folded into "${keepClaim.slice(0, 36)}…"`,
    );
  };
  const bulkPrune = () => {
    const ids = Object.keys(s.selected);
    if (!ids.length) return;
    act(
      ids,
      "prune",
      () => set((p) => {
        const next = { ...p.pruned };
        ids.forEach((id) => { next[id] = true; });
        return { pruned: next, selected: {} };
      }),
      () => set({ selected: {} }),
      pluralNodes(ids.length, "pruned."),
    );
  };

  const copy = (cmd: string) => {
    try {
      void navigator.clipboard?.writeText(cmd);
    } catch {
      /* clipboard unavailable */
    }
    set({ copied: cmd });
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => set({ copied: "" }), COPIED_MS);
  };

  const toggleStack = (name: string) => set((p) => ({ stackOff: toggleKey(p.stackOff, name) as Record<string, true> }));

  // ---- setup ----
  const scanDone = s.scanLines >= data.scan.length;
  const setupActions = {
    exit: () => go("overview"),
    back: () => set((p) => ({ setupStep: Math.max(0, p.setupStep - 1) })),
    next: () => {
      if (s.setupStep === 3) set({ screen: "overview" });
      else if (s.setupStep === 0 && !scanDone) {
        if (scanTimer.current) clearInterval(scanTimer.current);
        set({ scanLines: data.scan.length });
      } else set((p) => ({ setupStep: p.setupStep + 1 }));
    },
    toggleStack,
    setStackDraft: (v: string) => set({ stackDraft: v }),
    addStack: () =>
      set((p) =>
        p.stackDraft.trim()
          ? { stackExtra: [...p.stackExtra, { name: p.stackDraft.trim(), evidence: "added by hand" }], stackDraft: "" }
          : {},
      ),
    toggleProposal: (i: number) => set((p) => ({ dropped: toggleKey(p.dropped, i) as Record<number, true> })),
    setFactKind: (i: number, kind: NodeKind) =>
      set((p) => ({ ownFacts: p.ownFacts.map((f, j) => (j === i ? { ...f, kind } : f)) })),
    setFactText: (i: number, text: string) =>
      set((p) => ({ ownFacts: p.ownFacts.map((f, j) => (j === i ? { ...f, text } : f)) })),
    removeFact: (i: number) => set((p) => ({ ownFacts: p.ownFacts.filter((_, j) => j !== i) })),
    addFact: () => set((p) => ({ ownFacts: [...p.ownFacts, { kind: "Decision", text: "" }] })),
  };

  const [title, subtitle] = SCREEN_TITLES[s.screen];
  const navItems = [
    { id: "overview" as const, label: "Overview", badge: "" },
    { id: "sessions" as const, label: "Sessions", badge: String(data.sessionCount) },
    { id: "editor" as const, label: "Graph editor", badge: String(nodes.length) },
    { id: "fleet" as const, label: "Fleet", badge: String(data.fleet.repos) },
    { id: "commands" as const, label: "Commands", badge: "" },
    { id: "settings" as const, label: "Settings", badge: "" },
  ];

  return (
    <div className="mg" style={{ ["--mg-accent" as string]: accentColor }} data-testid="mg-root">
      {s.screen === "setup" ? (
        <Setup data={data} state={s} stack={stack} actions={setupActions} />
      ) : (
        <div className="mg-shell">
          <Sidebar
            repo={data.repo}
            daemon={data.daemon}
            screen={s.screen}
            items={navItems}
            onGo={go}
            onPalette={() => set({ paletteOpen: true, paletteQuery: "", paletteIndex: 0 })}
          />

          <main className="mg-main">
            <header className="mg-head">
              <div className="mg-head__title">
                <h1>{title}</h1>
                <span className="mg-head__sub">{subtitle}</span>
              </div>
              <div className="mg-head__right">
                <div className="mg-seg" role="group" aria-label="Window">
                  {WINDOWS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      className={`mg-seg__btn${s.window === w ? " mg-seg__btn--on" : ""}`}
                      onClick={() => set({ window: w })}
                      aria-pressed={s.window === w}
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <button type="button" className="mg-link" onClick={openTour}>
                  Tour
                </button>
              </div>
            </header>

            {s.screen === "overview" && (
              <Overview
                data={data}
                queue={queue}
                queueIndex={queueIndex}
                onFocus={(i) => set({ queueIndex: i })}
                onConfirm={(id) => resolve(id, "confirmed")}
                onReject={(id) => resolve(id, "rejected")}
                onOpenEditor={() => go("editor")}
                onOpenSessions={() => go("sessions")}
                onOpenSession={(i) => set({ screen: "sessions", session: i })}
              />
            )}
            {s.screen === "sessions" && (
              <Sessions sessions={data.sessions} selected={s.session} onSelect={(i) => set({ session: i })} />
            )}
            {s.screen === "editor" && (
              <Editor
                nodes={nodes}
                filter={s.filter}
                selected={s.selected}
                onFilter={(filter) => set({ filter })}
                onToggle={(id) => set((p) => ({ selected: toggleKey(p.selected, id) as Record<string, true> }))}
                onPin={bulkPin}
                onMerge={bulkMerge}
                onPrune={bulkPrune}
              />
            )}
            {s.screen === "fleet" && <Fleet repos={data.repos} totals={data.fleet} />}
            {s.screen === "commands" && <Commands sections={data.commands} copied={s.copied} onCopy={copy} />}
            {s.screen === "settings" && (
              <Settings
                data={data}
                state={s}
                stack={stack}
                onToggleStack={toggleStack}
                onEditor={() => go("editor")}
                onBudget={setBudget}
                onToggleKind={toggleKind}
                onMinWeight={onMinWeight}
                onMinWeightCommit={onMinWeightCommit}
                onDecay={setDecay}
                onRescan={() => go("setup")}
                injectedCount={data.inject?.injectedCount}
              />
            )}
          </main>
        </div>
      )}

      <Palette
        open={s.paletteOpen}
        query={s.paletteQuery}
        index={s.paletteIndex}
        items={paletteItems}
        onQuery={(paletteQuery) => set({ paletteQuery, paletteIndex: 0 })}
        onHover={(paletteIndex) => set({ paletteIndex })}
        onRun={runPalette}
        onClose={() => set({ paletteOpen: false })}
      />
      <Toast message={s.toast} />
      <Tour
        open={s.tourOpen}
        step={s.tourStep}
        steps={data.tour}
        rect={s.rect}
        onGo={(tourStep) => set({ tourStep, screen: data.tour[tourStep].screen })}
        onBack={() =>
          set((p) => {
            const n = Math.max(0, p.tourStep - 1);
            return { tourStep: n, screen: data.tour[n].screen };
          })
        }
        onNext={() => {
          if (s.tourStep === data.tour.length - 1) { endTour(); return; }
          const n = s.tourStep + 1;
          set({ tourStep: n, screen: data.tour[n].screen });
        }}
        onSkip={endTour}
      />
    </div>
  );
}
