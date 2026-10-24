import fs from "fs";
import path from "path";
import { HOSTS, installedHosts } from "@/lib/mg-config";
import { isoUtc } from "./iso-utc";

export interface AgentHost {
  name: string;
  installed: boolean;
  brief: string;
  brief_present: boolean;
  brief_mtime: string | null;
}

export interface Agents {
  hosts: AgentHost[];
}

export function agents(root: string): Agents {
  const installed = new Set(installedHosts(root));

  const hosts: AgentHost[] = Object.entries(HOSTS).map(([name, spec]) => {
    const briefPath = path.join(root, spec.brief);
    let brief_present = false;
    let brief_mtime: string | null = null;

    try {
      const st = fs.statSync(briefPath);
      if (st.isFile()) {
        brief_present = true;
        brief_mtime = isoUtc(st.mtimeMs);
      }
    } catch {
      // File doesn't exist
    }

    return {
      name,
      installed: installed.has(name),
      brief: spec.brief,
      brief_present,
      brief_mtime,
    };
  });

  return { hosts };
}
