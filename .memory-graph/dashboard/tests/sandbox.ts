import fs from "fs";
import path from "path";
import os from "os";

export interface Sandbox {
  root: string;
  cleanup(): void;
  write(relPath: string, content: string): void;
  read(relPath: string): string;
  mkdir(relPath: string): void;
}

export function makeSandbox(): Sandbox {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dash-test-"));

  return {
    root,
    cleanup() {
      if (fs.existsSync(root)) {
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
    write(relPath: string, content: string) {
      const full = path.join(root, relPath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, "utf-8");
    },
    read(relPath: string) {
      return fs.readFileSync(path.join(root, relPath), "utf-8");
    },
    mkdir(relPath: string) {
      fs.mkdirSync(path.join(root, relPath), { recursive: true });
    },
  };
}

/**
 * Stubs window.matchMedia to control prefers-reduced-motion.
 * Returns object with recorded query strings and restore function.
 */
export function stubMatchMedia(reduce: boolean): {
  calls: string[];
  restore(): void;
} {
  const calls: string[] = [];
  const original = window.matchMedia;

  window.matchMedia = ((query: string) => {
    calls.push(query);
    return {
      matches: reduce,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    };
  }) as any;

  return {
    calls,
    restore() {
      window.matchMedia = original;
    },
  };
}

/**
 * Fake EventSource for testing SSE consumers.
 */
export class FakeEventSource {
  static last: FakeEventSource | null = null;

  url: string;
  listeners: Record<string, ((e: { data: string }) => void)[]> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.last = this;
  }

  addEventListener(type: string, fn: (e: { data: string }) => void): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(fn);
  }

  removeEventListener(type: string, fn: (e: { data: string }) => void): void {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((f) => f !== fn);
    }
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: string): void {
    if (this.listeners[type]) {
      for (const fn of this.listeners[type]) {
        fn({ data });
      }
    }
  }
}

export function stubEventSource(): { restore(): void } {
  const original = globalThis.EventSource as any;
  globalThis.EventSource = FakeEventSource as any;

  return {
    restore() {
      globalThis.EventSource = original;
    },
  };
}

/**
 * Shared state fixtures from slices 1–2.
 */
export const GOOD_STATE = `
present: true
age_days: 2
pruned_percent: 15
entries:
  - file: "src/lib/motion.ts"
    tokens: 1200
    saved: 7800
  - file: "src/lib/debounce.ts"
    tokens: 840
    saved: 6100
  - file: "src/lib/watch.ts"
    tokens: 0
    saved: 0
`;

export const GOOD_SESSIONS = `
items:
  - id: "session-1"
    date: "2026-08-07"
    duration_seconds: 1200
    tokens_used: 4500
  - id: "session-2"
    date: "2026-08-07"
    duration_seconds: 2400
    tokens_used: 8200
  - id: "session-3"
    date: "2026-08-05"
    duration_seconds: 900
    tokens_used: 3100
`;

export const GOOD_GRAPH = `
nodes:
  - id: "A"
    label: "Slice 1"
  - id: "B"
    label: "Slice 2"
  - id: "C"
    label: "Slice 3"
links:
  - source: "A"
    target: "B"
  - source: "B"
    target: "C"
`;

export const COMPRESSION_LEDGER = {
  present: true as const,
  entries: [
    { at: "2026-08-05T10:00:00Z", tool: "compress", before: 9000, after: 1200, saved: 7800 },
    { at: "2026-08-06T10:00:00Z", tool: "compress", before: 7000, after: 900, saved: 6100 },
    { at: "2026-08-07T10:00:00Z", tool: "compress", before: 500, after: 500, saved: 0 },
  ],
  total_before: 16500,
  total_after: 2600,
  total_saved: 13900,
};

export const SESSION_FIXTURE = {
  present: true as const,
  count: 3,
  items: [
    {
      file: "sessions/2026-08-07-a.md",
      date: "2026-08-07",
      time: "10:00",
      session: 1,
      topics: "slice 3",
      context: "motion",
      scope: [],
      god_nodes_touched: [],
      open: [],
      blocked: [],
    },
    {
      file: "sessions/2026-08-07-b.md",
      date: "2026-08-07",
      time: "14:00",
      session: 2,
      topics: "slice 3",
      context: "motion",
      scope: [],
      god_nodes_touched: [],
      open: [],
      blocked: [],
    },
    {
      file: "sessions/2026-08-05-a.md",
      date: "2026-08-05",
      time: "09:00",
      session: 3,
      topics: "slice 2",
      context: "panels",
      scope: [],
      god_nodes_touched: [],
      open: [],
      blocked: [],
    },
  ],
};

export const GRAPH_FIXTURE = {
  present: true as const,
  node_count: 3,
  link_count: 2,
  truncated: false,
  nodes: [
    { id: "A", label: "Slice 1", community: null, type: "other", degree: 1, betweenness: null },
    { id: "B", label: "Slice 2", community: null, type: "other", degree: 2, betweenness: null },
    { id: "C", label: "Slice 3", community: null, type: "other", degree: 1, betweenness: null },
  ],
  links: [
    { source: "A", target: "B" },
    { source: "B", target: "C" },
  ],
};
