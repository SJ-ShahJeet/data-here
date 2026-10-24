"use client";

import { useState, useEffect } from "react";
import type { DashboardState } from "@/lib/scan";
import { changedNumericPaths } from "@/lib/changed-keys";

export const STREAM_PATH = "/api/stream";
export const STREAM_EVENT = "state";

export interface LiveState {
  state: DashboardState;
  changed: string[];
}

export function useLiveState(initial: DashboardState): LiveState {
  const [state, setState] = useState(initial);
  const [changed, setChanged] = useState<string[]>([]);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return;
    }

    const eventSource = new EventSource(STREAM_PATH);

    const handleMessage = (event: MessageEvent) => {
      try {
        const next = JSON.parse(event.data) as DashboardState;
        setState((current) => {
          const changedPaths = changedNumericPaths(current, next);
          setChanged(changedPaths);
          return next;
        });
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.addEventListener(STREAM_EVENT, handleMessage);

    return () => {
      eventSource.removeEventListener(STREAM_EVENT, handleMessage);
      eventSource.close();
    };
  }, []);

  return { state, changed };
}
