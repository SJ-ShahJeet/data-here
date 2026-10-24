import { execFile } from "child_process";
import { promisify } from "util";
import { repoRoot } from "@/lib/repo-root";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

// Fixed allowlist only — the client sends an id, never a command string, so
// there is no path from a request body to an executed shell string.
const RUNNABLE: Readonly<Record<string, { file: string; args: string[] }>> = {
  tokensavers: { file: "bash", args: ["scripts/enable-token-savers.sh"] },
  ollama: { file: "bash", args: ["scripts/enable-semantic-ollama.sh"] },
  "check-ollama": { file: "bash", args: ["scripts/check-ollama.sh"] },
  "graph-scout-check": { file: "bash", args: ["scripts/check-graph-scout-local.sh"] },
  "graph-scout-enable": { file: "bash", args: ["scripts/enable-graph-scout-local.sh"] },
  "semantic-auto": { file: "bash", args: ["scripts/enable-semantic-auto.sh"] },
  "token-first": { file: "bash", args: ["scripts/enable-token-first.sh"] },
  "test-static": { file: "bash", args: ["scripts/test-static.sh"] },
};

export async function POST(request: Request): Promise<Response> {
  let id: unknown;
  try {
    ({ id } = await request.json());
  } catch {
    return Response.json({ ok: false, error: "invalid request body" }, { status: 400 });
  }

  if (typeof id !== "string" || !(id in RUNNABLE)) {
    return Response.json({ ok: false, error: "unknown command id" }, { status: 400 });
  }

  const { file, args } = RUNNABLE[id];

  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      cwd: repoRoot(),
      timeout: 30_000,
    });
    return Response.json({ ok: true, output: (stdout || stderr).trim() });
  } catch (e) {
    // Check scripts (check-ollama.sh, check-graph-scout-local.sh) exit non-zero
    // by design to signal "not set up" while printing a helpful message on
    // stdout/stderr — surface that instead of the generic execFile message.
    const output =
      e && typeof e === "object" && ("stdout" in e || "stderr" in e)
        ? String((e as { stdout?: string; stderr?: string }).stdout || (e as { stderr?: string }).stderr || "").trim()
        : "";
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: output || message }, { status: 500 });
  }
}
