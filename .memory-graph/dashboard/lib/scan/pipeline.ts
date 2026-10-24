import fs from "fs";
import path from "path";
import { isoUtc } from "./iso-utc";

export interface PipelineCheck {
  name: string;
  path: string;
  present: boolean;
  mtime: string | null;
  detail: string;
}

export interface Pipeline {
  checks: PipelineCheck[];
}

export function pipeline(root: string): Pipeline {
  const checkDefs: Array<[string, string]> = [
    ["agent_brief", "memory/.agent-brief-status"],
    ["semantic_pending", "memory/.semantic-pending"],
    ["semantic_ollama", "memory/.semantic-ollama-status"],
    ["graph_scout", "memory/.graph-scout-status"],
  ];

  const checks: PipelineCheck[] = checkDefs.map(([name, filePath]) => {
    const fullPath = path.join(root, filePath);
    let present = false;
    let mtime: string | null = null;
    let detail = "";

    try {
      const st = fs.statSync(fullPath);
      if (st.isFile()) {
        present = true;
        mtime = isoUtc(st.mtimeMs);
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const firstLine = content.split(/\r?\n/)[0].trim();
          detail = firstLine;
        } catch {
          detail = "";
        }
      }
    } catch {
      // File doesn't exist
    }

    return { name, path: filePath, present, mtime, detail };
  });

  return { checks };
}
