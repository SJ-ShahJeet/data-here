import fs from "fs";
import path from "path";
import { parseSimpleYaml } from "@/lib/yaml";
import { sessionsDir } from "@/lib/mg-config";

export interface SessionItem {
  file: string;
  date: string;
  time: string;
  session: number | string | null;
  topics: string;
  context: string;
  scope: string[];
  god_nodes_touched: string[];
  open: string[];
  blocked: string[];
}

export interface Sessions {
  present: boolean;
  count: number;
  items: SessionItem[];
}

export function sessions(root: string, limit: number = 20): Sessions {
  const dir = sessionsDir(root);

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return { present: false, count: 0, items: [] };
  }

  // Filter for .md files, sort descending by name
  const mdFiles = entries.filter((name) => name.endsWith(".md")).sort().reverse();

  const items: SessionItem[] = [];

  for (const name of mdFiles) {
    const filePath = path.join(dir, name);

    let text: string;
    try {
      text = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const lines = text.split(/\r?\n/);

    // Must start with ---
    if (lines[0] !== "---") continue;

    // Find closing ---
    let j = 1;
    while (j < lines.length && lines[j] !== "---") {
      j++;
    }

    if (j >= lines.length) continue; // No closing ---

    const frontmatter = lines.slice(1, j).join("\n");
    const data = parseSimpleYaml(frontmatter);

    // Must have date key
    if (!data.date) continue;

    const coerceArray = (val: unknown): string[] => {
      if (Array.isArray(val)) return val.map(String);
      return [];
    };

    let sessionValue: number | string | null = null;
    if (typeof data.session === "string") {
      if (/^\d+$/.test(data.session)) {
        sessionValue = Number(data.session);
      } else {
        sessionValue = data.session;
      }
    }

    items.push({
      file: `sessions/${name}`,
      date: String(data.date),
      time: data.time == null ? "" : String(data.time),
      session: sessionValue,
      topics: data.topics == null ? "" : String(data.topics),
      context: data.context == null ? "" : String(data.context),
      scope: coerceArray(data.scope),
      god_nodes_touched: coerceArray(data.god_nodes_touched),
      open: coerceArray(data.open),
      blocked: coerceArray(data.blocked),
    });
  }

  const count = items.length;
  return {
    // `present` answers "does sessions/ exist?", not "does it have content?" —
    // the same reading as state.yaml and tiers. An existing-but-empty directory
    // is a real, distinct state: memory-graph is installed, no session yet.
    // The panels distinguish the two via `count`/`items.length`.
    present: true,
    count,
    items: items.slice(0, limit),
  };
}
