import fs from "fs";
import path from "path";
import { isoUtc } from "./iso-utc";
import { memoryDir } from "@/lib/mg-config";

export type FreshnessState = "absent" | "good" | "stale" | "old";

export interface Freshness {
  present: boolean;
  state: FreshnessState;
  updated: string | null;
  age_days: number | null;
  mtime: string | null;
}

export function freshness(root: string, today?: Date): Freshness {
  const p = path.join(memoryDir(root), "state.yaml");

  // Step 1: Check if file exists
  let st: fs.Stats;
  let text: string;
  try {
    st = fs.statSync(p);
    if (!st.isFile()) {
      return { present: false, state: "absent", updated: null, age_days: null, mtime: null };
    }
    text = fs.readFileSync(p, "utf8");
  } catch {
    return { present: false, state: "absent", updated: null, age_days: null, mtime: null };
  }

  // Step 3: Get today's date
  const todayDate = (today ?? new Date()).toISOString().slice(0, 10);

  // Step 4: Scan for updated line
  let updatedDate: string | null = null;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^updated:\s*(\S+)/);
    if (match) {
      const candidate = match[1];
      // Validate format YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
        // Test if it's a valid date
        const testDate = new Date(`${candidate}T00:00:00Z`);
        if (!isNaN(testDate.getTime())) {
          updatedDate = candidate;
        }
      }
      break;
    }
  }

  // Step 5: Fall back to mtime if no usable updated date
  if (!updatedDate) {
    updatedDate = new Date(st.mtimeMs).toISOString().slice(0, 10);
  }

  // Step 6: Calculate age_days
  const todayMs = Date.parse(todayDate + "T00:00:00Z");
  const updatedMs = Date.parse(updatedDate + "T00:00:00Z");
  const age_days = Math.round((todayMs - updatedMs) / 86400000);

  // Step 7: Determine state
  let state: FreshnessState;
  if (age_days <= 7) {
    state = "good";
  } else if (age_days <= 30) {
    state = "stale";
  } else {
    state = "old";
  }

  // Step 8: Return result
  return {
    present: true,
    state,
    updated: updatedDate,
    age_days,
    mtime: isoUtc(st.mtimeMs),
  };
}
