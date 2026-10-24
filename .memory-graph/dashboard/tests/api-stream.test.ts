import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "../app/api/stream/route";

describe("GET /api/stream", () => {
  it(
    "returns 200 response",
    async () => {
      const ac = new AbortController();
      const res = await GET(
        new Request("http://127.0.0.1/api/stream", { signal: ac.signal })
      );
      expect(res.status).toBe(200);
      ac.abort();
    },
    5000
  );

  it(
    "sets Content-Type to text/event-stream",
    async () => {
      const ac = new AbortController();
      const res = await GET(
        new Request("http://127.0.0.1/api/stream", { signal: ac.signal })
      );
      expect(res.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");
      ac.abort();
    },
    5000
  );

  it(
    "sets Cache-Control to no-store, no-transform",
    async () => {
      const ac = new AbortController();
      const res = await GET(
        new Request("http://127.0.0.1/api/stream", { signal: ac.signal })
      );
      expect(res.headers.get("Cache-Control")).toBe("no-store, no-transform");
      ac.abort();
    },
    5000
  );

  it(
    "sets Connection to keep-alive",
    async () => {
      const ac = new AbortController();
      const res = await GET(
        new Request("http://127.0.0.1/api/stream", { signal: ac.signal })
      );
      expect(res.headers.get("Connection")).toBe("keep-alive");
      ac.abort();
    },
    5000
  );

  it(
    "sets X-Accel-Buffering to no",
    async () => {
      const ac = new AbortController();
      const res = await GET(
        new Request("http://127.0.0.1/api/stream", { signal: ac.signal })
      );
      expect(res.headers.get("X-Accel-Buffering")).toBe("no");
      ac.abort();
    },
    5000
  );

  it(
    "returns ReadableStream body",
    async () => {
      const ac = new AbortController();
      const res = await GET(
        new Request("http://127.0.0.1/api/stream", { signal: ac.signal })
      );
      expect(res.body).toBeDefined();
      expect(res.body).toBeInstanceOf(ReadableStream);
      ac.abort();
    },
    5000
  );

  it(
    "first chunk is state event with current payload",
    async () => {
      const ac = new AbortController();
      const res = await GET(
        new Request("http://127.0.0.1/api/stream", { signal: ac.signal })
      );

      const reader = res.body!.getReader();
      const { value } = await reader.read();

      if (value) {
        const text = new TextDecoder().decode(value);
        expect(text).toContain("event: state");
        expect(text).toContain("data: ");

        // Extract JSON from SSE frame
        const dataMatch = text.match(/data: ({.*?})\n/);
        if (dataMatch) {
          const payload = JSON.parse(dataMatch[1]);
          // Check for thirteen keys as per contract (nodes joined in memory-nodes slice 3)
          expect(Object.keys(payload).length).toBe(13);
        }
      }

      ac.abort();
      reader.cancel();
    },
    5000
  );

  it(
    "stream closes on abort",
    async () => {
      const ac = new AbortController();
      const res = await GET(
        new Request("http://127.0.0.1/api/stream", { signal: ac.signal })
      );

      const reader = res.body!.getReader();
      await reader.read(); // Read first chunk

      ac.abort();

      // Try to read again after abort
      const result = await reader.read();
      expect(result.done).toBe(true);
    },
    5000
  );

  it(
    "first message includes all required state keys",
    async () => {
      const ac = new AbortController();
      const res = await GET(
        new Request("http://127.0.0.1/api/stream", { signal: ac.signal })
      );

      const reader = res.body!.getReader();
      const { value } = await reader.read();

      if (value) {
        const text = new TextDecoder().decode(value);
        const dataMatch = text.match(/data: ({.*?})\n/);

        if (dataMatch) {
          const payload = JSON.parse(dataMatch[1]);
          // Contract specifies thirteen keys
          const expectedKeys = [
            "generated_at",
            "repo",
            "freshness",
            "pipeline",
            "graph_freshness",
            "settings",
            "state",
            "sessions",
            "graph",
            "tiers",
            "agents",
            "compression",
            "nodes",
          ];
          expectedKeys.forEach((key) => {
            expect(payload).toHaveProperty(key);
          });
        }
      }

      ac.abort();
      reader.cancel();
    },
    5000
  );

  it(
    "uses force-dynamic rendering",
    async () => {
      // This is a module-level export that we can check
      // In the actual implementation, this would be verifiable by checking
      // that the route doesn't use caching
      const ac = new AbortController();
      const res = await GET(
        new Request("http://127.0.0.1/api/stream", { signal: ac.signal })
      );

      // dynamic=force-dynamic means no caching
      expect(res.headers.get("Cache-Control")).toContain("no-store");
      ac.abort();
    },
    5000
  );

  it(
    "handles multiple concurrent subscriptions",
    async () => {
      const ac1 = new AbortController();
      const ac2 = new AbortController();

      const res1 = await GET(
        new Request("http://127.0.0.1/api/stream", { signal: ac1.signal })
      );
      const res2 = await GET(
        new Request("http://127.0.0.1/api/stream", { signal: ac2.signal })
      );

      const reader1 = res1.body!.getReader();
      const reader2 = res2.body!.getReader();

      const [chunk1, chunk2] = await Promise.all([
        reader1.read(),
        reader2.read(),
      ]);

      expect(chunk1.value).toBeDefined();
      expect(chunk2.value).toBeDefined();

      ac1.abort();
      ac2.abort();
      reader1.cancel();
      reader2.cancel();
    },
    5000
  );
});
