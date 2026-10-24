"use client";
import { useRouter } from "next/navigation";
import type { DashboardData, NodeAction } from "@/lib/v2/types";
import { MemoryGraphV2 } from "./MemoryGraphV2";

/** POSTs JSON and throws the server's error message when the response isn't OK. */
async function post(url: string, body: unknown): Promise<Response> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error ?? `HTTP ${res.status}`);
  }
  return res;
}

/**
 * Wires the v2 screens to the real backend: node review actions write
 * through `/api/nodes`, injection settings through `/api/settings`, and
 * either kind of write refreshes the server-rendered page so the screen
 * reflects what actually landed on disk.
 */
export function LiveDashboard({ data }: { data: DashboardData }) {
  const router = useRouter();

  const onNodes = (action: NodeAction, ids: string[]) =>
    post("/api/nodes", { ids, action }).then(() => router.refresh());

  const onSettings = (changes: Record<string, string>) =>
    post("/api/settings", { changes }).then(() => router.refresh());

  return <MemoryGraphV2 data={data} onNodes={onNodes} onSettings={onSettings} />;
}
