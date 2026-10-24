import fs from "fs";
import path from "path";
import { memoryDir, sessionsDir } from "@/lib/mg-config";

export interface Tiers {
  hot: { present: boolean; bytes: number; path: string };
  warm: { count: number; bytes: number; path: string };
  cold: { count: number; bytes: number; path: string };
  brief: { present: boolean; bytes: number; path: string };
}

export function tiers(root: string): Tiers {
  // Hot: memory/state.yaml
  let hotBytes = 0;
  let hotPresent = false;
  try {
    const st = fs.statSync(path.join(memoryDir(root), "state.yaml"));
    if (st.isFile()) {
      hotPresent = true;
      hotBytes = st.size;
    }
  } catch {
    // File doesn't exist
  }

  // Brief: memory/.agent-brief.yaml
  let briefBytes = 0;
  let briefPresent = false;
  try {
    const st = fs.statSync(path.join(memoryDir(root), ".agent-brief.yaml"));
    if (st.isFile()) {
      briefPresent = true;
      briefBytes = st.size;
    }
  } catch {
    // File doesn't exist
  }

  // Warm: sessions/*.md
  let warmCount = 0;
  let warmBytes = 0;
  try {
    const entries = fs.readdirSync(sessionsDir(root));
    for (const entry of entries) {
      if (entry.endsWith(".md")) {
        try {
          const st = fs.statSync(path.join(sessionsDir(root), entry));
          if (st.isFile()) {
            warmCount++;
            warmBytes += st.size;
          }
        } catch {
          // Skip files we can't stat
        }
      }
    }
  } catch {
    // sessions directory doesn't exist
  }

  // Cold: sessions/archive/*.yaml and sessions/archive/*.md
  let coldCount = 0;
  let coldBytes = 0;
  try {
    const entries = fs.readdirSync(path.join(sessionsDir(root), "archive"));
    for (const entry of entries) {
      if (entry.endsWith(".yaml") || entry.endsWith(".md")) {
        try {
          const st = fs.statSync(path.join(sessionsDir(root), "archive", entry));
          if (st.isFile()) {
            coldCount++;
            coldBytes += st.size;
          }
        } catch {
          // Skip files we can't stat
        }
      }
    }
  } catch {
    // archive directory doesn't exist
  }

  return {
    hot: { present: hotPresent, bytes: hotBytes, path: "memory/state.yaml" },
    warm: { count: warmCount, bytes: warmBytes, path: "sessions/" },
    cold: { count: coldCount, bytes: coldBytes, path: "sessions/archive/" },
    brief: { present: briefPresent, bytes: briefBytes, path: "memory/.agent-brief.yaml" },
  };
}
