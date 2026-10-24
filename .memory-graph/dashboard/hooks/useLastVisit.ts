"use client";

import { useEffect, useState } from "react";

const KEY = "mg:last-visit";

/**
 * A page load stamps the visit once. React runs effects twice in development
 * StrictMode, and without this the second pass reads back the timestamp the first
 * pass just wrote — so a genuine first visit reported "you were last here" with
 * the current time, which is the one thing this marker must never say.
 */
let stamped = false;

/**
 * When this browser last had the dashboard open.
 *
 * The product's stated job is opening a repo after a week away and knowing what
 * changed. The page could report every absolute state except the one relative to
 * you — so the header printed "Page loaded <now>", which is a fact you already had.
 *
 * Read and written in an effect rather than during render: `localStorage` does not
 * exist on the server, and a value that differs between the two passes would
 * mismatch during hydration. The first paint therefore shows no marker, which is
 * correct — on a genuine first visit there is nothing to show.
 *
 * This is browser state, not memory state. It is never written to
 * `.memory-graph/memory/`, and nothing on the page derives a *reading* from it.
 */
export function useLastVisit(): string | null {
  const [previous, setPrevious] = useState<string | null>(null);

  useEffect(() => {
    if (stamped) return;
    stamped = true;
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored) setPrevious(stored);
      window.localStorage.setItem(KEY, new Date().toISOString());
    } catch {
      // Storage can be disabled or full. The marker is a convenience; losing it
      // costs nothing, and failing loudly here would break a working dashboard.
    }
  }, []);

  return previous;
}
