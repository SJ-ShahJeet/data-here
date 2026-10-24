import fs from "fs";
import path from "path";

export interface CompressionEntry {
  at: string;
  tool: string;
  before: number;
  after: number;
  saved: number;
}

export interface Compression {
  present: boolean;
  entries: CompressionEntry[];
  total_before: number;
  total_after: number;
  total_saved: number;
}

export const COMPRESSION_LOG_REL = "memory/.compression-log.jsonl";
export const COMPRESSION_MAX_ENTRIES = 200;

export function compression(root: string): Compression {
  const logPath = path.join(root, COMPRESSION_LOG_REL);

  let text: string;
  try {
    text = fs.readFileSync(logPath, "utf-8");
  } catch {
    return {
      present: false,
      entries: [],
      total_before: 0,
      total_after: 0,
      total_saved: 0,
    };
  }

  const entries: CompressionEntry[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;

    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      // Skip malformed lines
      continue;
    }

    if (!record || typeof record !== "object") continue;

    const rec = record as Record<string, unknown>;
    const at = rec.at;
    const tool = rec.tool;
    const before = rec.before;
    const after = rec.after;

    // Validate record structure
    if (typeof at !== "string" || typeof tool !== "string") continue;
    if (typeof before !== "number" || !isFinite(before)) continue;
    if (typeof after !== "number" || !isFinite(after)) continue;

    entries.push({
      at,
      tool,
      before,
      after,
      saved: Math.max(0, before - after),
    });
  }

  // Keep only the last COMPRESSION_MAX_ENTRIES
  const keptEntries = entries.slice(-COMPRESSION_MAX_ENTRIES);

  let total_before = 0;
  let total_after = 0;
  let total_saved = 0;

  for (const entry of keptEntries) {
    total_before += entry.before;
    total_after += entry.after;
    total_saved += entry.saved;
  }

  return {
    present: keptEntries.length > 0,
    entries: keptEntries,
    total_before,
    total_after,
    total_saved,
  };
}
