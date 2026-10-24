import chokidar from "chokidar";
import { debounce } from "./debounce";
import { mgPath } from "./mg-config";

export interface MemoryWatcher {
  close(): Promise<void>;
}

export const WATCH_DEBOUNCE_MS = 250;
export const WATCHED_KEYS = ["memory", "sessions", "graph"] as const;

export function watchMemory(
  root: string,
  onChange: () => void,
  opts?: { debounceMs?: number }
): MemoryWatcher {
  const debounceMs = opts?.debounceMs ?? WATCH_DEBOUNCE_MS;
  const debouncedOnChange = debounce(onChange, debounceMs);

  const watchPaths = WATCHED_KEYS.map((key) => mgPath(root, key));

  const watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    ignored: /(^|[\\/])\.(git|next)([\\/]|$)/,
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
  });

  watcher.on("all", () => {
    debouncedOnChange();
  });

  watcher.on("error", () => {
    // Swallow errors
  });

  return {
    async close() {
      debouncedOnChange.cancel();
      await watcher.close();
    },
  };
}
