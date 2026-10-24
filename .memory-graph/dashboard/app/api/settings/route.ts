import fs from "fs";
import path from "path";
import { DEFAULTS, loadConfig, mgHome } from "@/lib/mg-config";
import { repoRoot } from "@/lib/repo-root";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEY_RE = /^[a-z_][a-z0-9_]*$/;

// .memory-graph/ollama.yaml, when present, overlays config.yaml and wins
// (see loadConfig) — so a key already defined there must be edited there,
// or the write would have no visible effect.
function targetConfigFile(root: string, key: string): string {
  const ollamaPath = path.join(mgHome(root), "ollama.yaml");
  try {
    const text = fs.readFileSync(ollamaPath, "utf-8");
    if (new RegExp(`^\\s*${key}:`, "m").test(text)) return ollamaPath;
  } catch {
    // ollama.yaml doesn't exist — falls through to config.yaml
  }
  return path.join(mgHome(root), "config.yaml");
}

function upsertLine(text: string, key: string, value: string): string {
  // Global, not just first-match: some config.yaml files carry the same key
  // both inside a `core:`/`ollama:` section and as a flat top-level
  // fallback (the flat one is merged last in loadConfig and wins) — patching
  // only the first occurrence would silently edit the copy that loses.
  const re = new RegExp(`^(\\s*)${key}:.*$`, "gm");
  let matched = false;
  const next = text.replace(re, (_match, indent: string) => {
    matched = true;
    return `${indent}${key}: ${value}`;
  });
  if (matched) return next;
  const sep = text.length && !text.endsWith("\n") ? "\n" : "";
  return `${text}${sep}${key}: ${value}\n`;
}

export async function POST(request: Request): Promise<Response> {
  let changes: unknown;
  try {
    ({ changes } = await request.json());
  } catch {
    return Response.json({ ok: false, error: "invalid request body" }, { status: 400 });
  }

  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return Response.json({ ok: false, error: "changes must be an object" }, { status: 400 });
  }

  const entries = Object.entries(changes as Record<string, unknown>);
  if (entries.length === 0) {
    return Response.json({ ok: false, error: "no changes given" }, { status: 400 });
  }

  const root = repoRoot();
  const current = loadConfig(root);

  for (const [key, value] of entries) {
    if (!KEY_RE.test(key) || !(key in DEFAULTS)) {
      return Response.json({ ok: false, error: `unknown setting: ${key}` }, { status: 400 });
    }
    if (typeof value !== "string" || /[\r\n]/.test(value) || value.length > 500) {
      return Response.json({ ok: false, error: `invalid value for ${key}` }, { status: 400 });
    }
    const curType = typeof current[key];
    if (curType === "boolean" && !/^(true|false)$/i.test(value)) {
      return Response.json(
        { ok: false, error: `${key} must be true or false` },
        { status: 400 }
      );
    }
    if (curType === "number" && !/^-?\d+(\.\d+)?$/.test(value)) {
      return Response.json({ ok: false, error: `${key} must be a number` }, { status: 400 });
    }
  }

  const written: string[] = [];
  for (const [key, rawValue] of entries) {
    const value = rawValue as string;
    const filePath = targetConfigFile(root, key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    let text = "";
    try {
      text = fs.readFileSync(filePath, "utf-8");
    } catch {
      // file doesn't exist yet — upsertLine creates it
    }
    fs.writeFileSync(filePath, upsertLine(text, key, value));
    written.push(key);
  }

  return Response.json({ ok: true, written });
}
