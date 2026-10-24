// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { SAMPLE } from "@/lib/v2/sample";
import { LiveDashboard } from "./LiveDashboard";

// Node 22+ defines an experimental `localStorage` global that is undefined
// unless --localstorage-file is set, and it shadows jsdom's. Install a plain
// in-memory Storage so the tour's "seen" flag has somewhere to go.
function installLocalStorage(): Storage {
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => { store.delete(k); },
    setItem: (k, v) => { store.set(k, String(v)); },
  };
  Object.defineProperty(globalThis, "localStorage", { value: shim, configurable: true, writable: true });
  return shim;
}

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("LiveDashboard", () => {
  beforeEach(() => {
    installLocalStorage();
    window.scrollTo = vi.fn();
    refresh.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scenario 31: clicking Confirm POSTs /api/nodes with the ids and action, then calls router.refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, nodes: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveDashboard data={SAMPLE} />);
    const rows = screen.getAllByTestId("mg-queue-row");
    fireEvent.click(within(rows[0]).getByText("Confirm"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/nodes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      ids: [SAMPLE.queue[0].id],
      action: "confirm",
    });

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("scenario 32: a non-2xx /api/nodes response surfaces a 'Could not save' toast", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ ok: false, error: "bad request" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveDashboard data={SAMPLE} />);
    const rows = screen.getAllByTestId("mg-queue-row");
    fireEvent.click(within(rows[0]).getByText("Reject"));

    const toast = await screen.findByTestId("mg-toast");
    expect(toast).toHaveTextContent("Could not save");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("scenario 33: a settings change POSTs /api/settings with a changes object, then calls router.refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, written: ["inject_budget_tokens"] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LiveDashboard data={SAMPLE} />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    fireEvent.click(screen.getByText("12k"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/settings");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      changes: { inject_budget_tokens: "12000" },
    });

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
