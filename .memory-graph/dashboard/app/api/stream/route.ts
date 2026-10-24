import { collect } from "@/lib/scan";
import { repoRoot } from "@/lib/repo-root";
import { sseFrame } from "@/lib/sse";
import { watchMemory } from "@/lib/watch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const root = repoRoot();

      // Send initial state immediately
      const initialState = collect(root);
      controller.enqueue(encoder.encode(sseFrame("state", initialState)));

      // Watch for changes
      const watcher = watchMemory(root, () => {
        const updatedState = collect(root);
        controller.enqueue(encoder.encode(sseFrame("state", updatedState)));
      });

      // Handle abort
      const handleAbort = () => {
        watcher.close().catch(() => {
          // Ignore errors
        });
        controller.close();
      };

      request.signal.addEventListener("abort", handleAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
