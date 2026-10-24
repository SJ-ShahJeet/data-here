import { collect } from "@/lib/scan";
import { repoRoot } from "@/lib/repo-root";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const body = collect(repoRoot());
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
