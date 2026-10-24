import fs from "fs";
import path from "path";
import { parseSimpleYaml } from "@/lib/yaml";
import { memoryDir } from "@/lib/mg-config";

export interface StateYaml {
  present: boolean;
  updated: string | null;
  sessions_active: number | null;
  open: string[];
  blocked: string[];
  god_nodes_recent: string[];
  recent_context: string[];
}

export function stateYaml(root: string): StateYaml {
  const statePath = path.join(memoryDir(root), "state.yaml");

  let text: string;
  try {
    text = fs.readFileSync(statePath, "utf-8");
  } catch {
    return {
      present: false,
      updated: null,
      sessions_active: null,
      open: [],
      blocked: [],
      god_nodes_recent: [],
      recent_context: [],
    };
  }

  const data = parseSimpleYaml(text);

  const updated = data.updated == null ? null : String(data.updated);

  let sessions_active: number | null = null;
  if (typeof data.sessions_active === "string" && /^\d+$/.test(data.sessions_active)) {
    sessions_active = Number(data.sessions_active);
  }

  const coerceArray = (val: unknown): string[] => {
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === "string") return [];
    return [];
  };

  return {
    present: true,
    updated,
    sessions_active,
    open: coerceArray(data.open),
    blocked: coerceArray(data.blocked),
    god_nodes_recent: coerceArray(data.god_nodes_recent),
    recent_context: coerceArray(data.recent_context),
  };
}
