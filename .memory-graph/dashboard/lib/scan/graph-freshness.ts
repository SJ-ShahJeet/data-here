import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { isoUtc } from "./iso-utc";
import { graphJson } from "@/lib/mg-config";

export interface GraphFreshness {
  present: boolean;
  graph_mtime: string | null;
  last_commit: string | null;
  behind: boolean | null;
}

export function graphFreshness(root: string): GraphFreshness {
  const graphPath = graphJson(root);

  let st: fs.Stats;
  try {
    st = fs.statSync(graphPath);
    if (!st.isFile()) {
      return { present: false, graph_mtime: null, last_commit: null, behind: null };
    }
  } catch {
    return { present: false, graph_mtime: null, last_commit: null, behind: null };
  }

  const graph_mtime = isoUtc(st.mtimeMs);
  let last_commit: string | null = null;

  try {
    const result = spawnSync("git", ["log", "-1", "--format=%cI"], {
      cwd: root,
      encoding: "utf-8",
      timeout: 5000,
    });

    if (result.status === 0 && result.stdout) {
      const trimmed = result.stdout.trim();
      if (trimmed) {
        last_commit = trimmed;
      }
    }
  } catch {
    // git command failed or directory is not a git repo
  }

  let behind: boolean | null = null;
  if (last_commit) {
    const commitTime = Date.parse(last_commit);
    if (!isNaN(commitTime)) {
      behind = commitTime > st.mtimeMs;
    }
  }

  return { present: true, graph_mtime, last_commit, behind };
}
