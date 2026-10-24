import path from "path";

import { HOME_DIR } from "./mg-config";

export function repoRoot(): string {
  const envValue = process.env.REPO_ROOT?.trim();
  if (envValue) {
    return path.resolve(envValue);
  }
  // The dashboard ships inside .memory-graph/, so the repo is two levels up —
  // one level up in a repo installed before the layout consolidation.
  const parent = path.resolve(process.cwd(), "..");
  return path.basename(parent) === HOME_DIR ? path.resolve(parent, "..") : parent;
}
