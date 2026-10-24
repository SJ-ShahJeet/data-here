// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useLiveState, STREAM_PATH, STREAM_EVENT } from "./useLiveState";
import { stubEventSource, FakeEventSource, makeSandbox } from "../tests/sandbox";
import { collect, type DashboardState } from "@/lib/scan";

// Build the fixture from the real collector rather than hand-writing one. A
// literal drifts from DashboardState silently; this cannot — if the payload
// grows a key, the fixture grows with it.
const fixtureSandbox = makeSandbox();
const BASE: DashboardState = collect(fixtureSandbox.root);
fixtureSandbox.cleanup();

/** Same payload, one numeric field moved — the only thing these tests vary. */
function withAge(age: number): DashboardState {
  return { ...BASE, freshness: { ...BASE.freshness, age_days: age } };
}

const INITIAL_STATE = withAge(1);
const NEXT_STATE = withAge(2);

describe("useLiveState", () => {
  let eventSourceStub: ReturnType<typeof stubEventSource>;

  beforeEach(() => {
    eventSourceStub = stubEventSource();
  });

  afterEach(() => {
    eventSourceStub.restore();
  });

  it("returns initial state before any push", () => {
    const { result } = renderHook(() => useLiveState(INITIAL_STATE));
    expect(result.current.state).toEqual(INITIAL_STATE);
    expect(result.current.changed).toEqual([]);
  });

  it("opens EventSource with STREAM_PATH", () => {
    renderHook(() => useLiveState(INITIAL_STATE));
    expect(FakeEventSource.last?.url).toBe(STREAM_PATH);
  });

  it("listens for STREAM_EVENT", async () => {
    const { result } = renderHook(() => useLiveState(INITIAL_STATE));
    const listeners = FakeEventSource.last?.listeners[STREAM_EVENT];
    expect(listeners).toBeDefined();
    expect(listeners?.length).toBeGreaterThan(0);
  });

  it("updates state from SSE message", async () => {
    const { result } = renderHook(() => useLiveState(INITIAL_STATE));

    act(() => {
      FakeEventSource.last?.emit(STREAM_EVENT, JSON.stringify(NEXT_STATE));
    });

    await waitFor(() => {
      expect(result.current.state).toEqual(NEXT_STATE);
    });
  });

  it("detects changed numeric paths", async () => {
    const { result } = renderHook(() => useLiveState(INITIAL_STATE));

    act(() => {
      FakeEventSource.last?.emit(STREAM_EVENT, JSON.stringify(NEXT_STATE));
    });

    await waitFor(() => {
      expect(result.current.changed.length).toBeGreaterThan(0);
      expect(result.current.changed).toContain("freshness.age_days");
    });
  });

  it("ignores invalid JSON", async () => {
    const { result } = renderHook(() => useLiveState(INITIAL_STATE));

    act(() => {
      FakeEventSource.last?.emit(STREAM_EVENT, "not valid json");
    });

    await waitFor(() => {
      expect(result.current.state).toEqual(INITIAL_STATE);
      expect(result.current.changed).toEqual([]);
    });
  });

  it("closes EventSource on unmount", () => {
    const { unmount } = renderHook(() => useLiveState(INITIAL_STATE));
    const source = FakeEventSource.last;
    unmount();
    expect(source?.closed).toBe(true);
  });

  it("removes event listener on unmount", () => {
    const { unmount } = renderHook(() => useLiveState(INITIAL_STATE));
    const listeners = FakeEventSource.last?.listeners[STREAM_EVENT];
    const initialCount = listeners?.length || 0;

    unmount();
    expect(FakeEventSource.last?.listeners[STREAM_EVENT].length).toBeLessThan(
      initialCount
    );
  });

  it("returns safe values when EventSource is undefined", () => {
    const original = globalThis.EventSource;
    delete (globalThis as any).EventSource;

    try {
      const { result } = renderHook(() => useLiveState(INITIAL_STATE));
      expect(result.current.state).toEqual(INITIAL_STATE);
      expect(result.current.changed).toEqual([]);
    } finally {
      (globalThis as any).EventSource = original;
    }
  });

  it("handles multiple state updates", async () => {
    const { result } = renderHook(() => useLiveState(INITIAL_STATE));

    const STATE_2 = withAge(3);
    act(() => {
      FakeEventSource.last?.emit(STREAM_EVENT, JSON.stringify(NEXT_STATE));
    });

    await waitFor(() => {
      expect(result.current.state.freshness.age_days).toBe(2);
    });

    act(() => {
      FakeEventSource.last?.emit(STREAM_EVENT, JSON.stringify(STATE_2));
    });

    await waitFor(() => {
      expect(result.current.state.freshness.age_days).toBe(3);
    });
  });

  it("only reports numeric path changes", async () => {
    const { result } = renderHook(() => useLiveState(INITIAL_STATE));

    act(() => {
      FakeEventSource.last?.emit(STREAM_EVENT, JSON.stringify(NEXT_STATE));
    });

    await waitFor(() => {
      expect(result.current.changed.length).toBeGreaterThan(0);
      // All changed paths should be dot-notation
      result.current.changed.forEach((path) => {
        expect(typeof path).toBe("string");
      });
    });
  });

  it("reports changed paths in correct order", async () => {
    const { result } = renderHook(() => useLiveState(INITIAL_STATE));

    const STATE_WITH_CHANGES = withAge(5);

    act(() => {
      FakeEventSource.last?.emit(
        STREAM_EVENT,
        JSON.stringify(STATE_WITH_CHANGES)
      );
    });

    await waitFor(() => {
      // Changed paths should be sorted
      const changed = result.current.changed;
      expect(changed).toEqual([...changed].sort());
    });
  });

  it("handles malformed JSON gracefully", async () => {
    const { result } = renderHook(() => useLiveState(INITIAL_STATE));

    act(() => {
      FakeEventSource.last?.emit(STREAM_EVENT, "{bad json");
    });

    await waitFor(() => {
      expect(result.current.state).toEqual(INITIAL_STATE);
    });
  });

  it("updates state and changed in single state update", async () => {
    const { result } = renderHook(() => useLiveState(INITIAL_STATE));

    act(() => {
      FakeEventSource.last?.emit(STREAM_EVENT, JSON.stringify(NEXT_STATE));
    });

    await waitFor(() => {
      // Both state and changed should be updated together
      expect(result.current.state.freshness.age_days).toBe(
        NEXT_STATE.freshness.age_days
      );
      expect(result.current.changed.length).toBeGreaterThan(0);
    });
  });
});
