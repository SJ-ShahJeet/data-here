// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryGraphV2 } from "./MemoryGraphV2";
import { SAMPLE } from "@/lib/v2/sample";
import { KINDS } from "@/lib/v2/constants";

function mount() {
  return render(<MemoryGraphV2 tour={false} />);
}

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

describe("MemoryGraphV2", () => {
  beforeEach(() => {
    installLocalStorage();
    window.scrollTo = vi.fn();
  });

  it("renders the overview with every metric and the review queue", () => {
    mount();
    expect(screen.getByTestId("mg-overview")).toBeInTheDocument();
    const stats = within(screen.getByTestId("mg-overview").querySelector("[data-tour=stats]") as HTMLElement);
    for (const m of SAMPLE.metrics) {
      expect(stats.getByText(m.label)).toBeInTheDocument();
      expect(stats.getByText(m.value)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId("mg-queue-row")).toHaveLength(SAMPLE.queue.length);
  });

  it("navigates between screens from the sidebar", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Graph editor/ }));
    expect(screen.getByTestId("mg-editor")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Fleet/ }));
    expect(screen.getByTestId("mg-fleet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Commands/ }));
    expect(screen.getByTestId("mg-commands")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    expect(screen.getByTestId("mg-settings")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sessions/ }));
    expect(screen.getByTestId("mg-sessions")).toBeInTheDocument();
  });

  it("confirms a queue item from its button and shows a toast", () => {
    mount();
    const rows = screen.getAllByTestId("mg-queue-row");
    fireEvent.click(within(rows[0]).getByText("Confirm"));
    expect(screen.getAllByTestId("mg-queue-row")).toHaveLength(SAMPLE.queue.length - 1);
    expect(screen.getByTestId("mg-toast")).toHaveTextContent("Confirmed");
  });

  it("reviews the queue from the keyboard: j moves, r rejects", () => {
    mount();
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { key: "r" });
    const rows = screen.getAllByTestId("mg-queue-row");
    expect(rows).toHaveLength(SAMPLE.queue.length - 1);
    expect(screen.queryByText(SAMPLE.queue[1].claim)).not.toBeInTheDocument();
    expect(screen.getByTestId("mg-toast")).toHaveTextContent("Rejected");
  });

  it("opens the palette with ⌘K, filters, and runs the highlighted entry", () => {
    mount();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const palette = screen.getByTestId("mg-palette");
    fireEvent.change(within(palette).getByRole("textbox"), { target: { value: "fleet" } });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.queryByTestId("mg-palette")).not.toBeInTheDocument();
    expect(screen.getByTestId("mg-fleet")).toBeInTheDocument();
  });

  it("pins selected editor rows and clears the selection", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Graph editor/ }));
    fireEvent.click(screen.getByRole("button", { name: `Select ${SAMPLE.nodes[3].claim}` }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pin" }));
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    const row = screen.getByText(SAMPLE.nodes[3].claim).closest("[data-testid=mg-node-row]")!;
    expect(within(row as HTMLElement).getByText("pinned")).toBeInTheDocument();
  });

  it("merges two rows into the heavier one", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Graph editor/ }));
    fireEvent.click(screen.getByRole("button", { name: `Select ${SAMPLE.nodes[0].claim}` }));
    fireEvent.click(screen.getByRole("button", { name: `Select ${SAMPLE.nodes[10].claim}` }));
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    expect(screen.getByText(SAMPLE.nodes[0].claim)).toBeInTheDocument();
    expect(screen.queryByText(SAMPLE.nodes[10].claim)).not.toBeInTheDocument();
    expect(screen.getByTestId("mg-toast")).toHaveTextContent("2 nodes folded");
  });

  it("runs the setup wizard end to end", () => {
    vi.useFakeTimers();
    try {
      mount();
      fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
      fireEvent.click(screen.getByRole("button", { name: "Re-scan" }));
      expect(screen.getByTestId("mg-setup")).toBeInTheDocument();
      expect(screen.getByText("Skip to results")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Skip to results"));
      expect(screen.getByText(`done · ${SAMPLE.scanDuration}`)).toBeInTheDocument();
      fireEvent.click(screen.getByText("Continue"));
      expect(screen.getByText("Confirm the stack")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Continue"));
      expect(screen.getByText("Review what it found")).toBeInTheDocument();
      fireEvent.click(screen.getByText(SAMPLE.proposals[0].claim));
      expect(screen.getByText(`${SAMPLE.proposals.length - 1}/${SAMPLE.proposals.length}`)).toBeInTheDocument();
      fireEvent.click(screen.getByText("Continue"));
      expect(screen.getByText("Finish setup")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Finish setup"));
      expect(screen.getByTestId("mg-overview")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens the tour on first visit and remembers dismissal", () => {
    render(<MemoryGraphV2 />);
    expect(screen.getByTestId("mg-tour")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Skip"));
    expect(screen.queryByTestId("mg-tour")).not.toBeInTheDocument();
    expect(localStorage.getItem("mg2-tour-seen")).toBe("1");
  });

  it("applies the accent colour prop as a CSS variable", () => {
    render(<MemoryGraphV2 tour={false} accentColor="#97ead2" />);
    expect(screen.getByTestId("mg-root").getAttribute("style")).toContain("--mg-accent: #97ead2");
  });
});

describe("live mode: onNodes prop (nodes write back)", () => {
  beforeEach(() => {
    installLocalStorage();
    window.scrollTo = vi.fn();
  });

  it("scenario 21: Confirm button calls onNodes with the row's id and the row stays until data props change", () => {
    const onNodes = vi.fn().mockResolvedValue(undefined);
    render(<MemoryGraphV2 tour={false} onNodes={onNodes} />);
    const rows = screen.getAllByTestId("mg-queue-row");
    fireEvent.click(within(rows[0]).getByText("Confirm"));
    expect(onNodes).toHaveBeenCalledWith("confirm", [SAMPLE.queue[0].id]);
    expect(screen.getAllByTestId("mg-queue-row")).toHaveLength(SAMPLE.queue.length);
  });

  it("scenario 22: keyboard 'c' on the highlighted queue item calls onNodes with confirm", () => {
    const onNodes = vi.fn().mockResolvedValue(undefined);
    render(<MemoryGraphV2 tour={false} onNodes={onNodes} />);
    fireEvent.keyDown(window, { key: "c" });
    expect(onNodes).toHaveBeenCalledWith("confirm", [SAMPLE.queue[0].id]);
  });

  it("scenario 23: a rejected onNodes promise shows a 'Could not save' toast and changes nothing else", async () => {
    const onNodes = vi.fn().mockRejectedValue(new Error("network down"));
    render(<MemoryGraphV2 tour={false} onNodes={onNodes} />);
    const rows = screen.getAllByTestId("mg-queue-row");
    fireEvent.click(within(rows[0]).getByText("Reject"));
    const toast = await screen.findByTestId("mg-toast");
    expect(toast).toHaveTextContent("Could not save");
    expect(screen.getAllByTestId("mg-queue-row")).toHaveLength(SAMPLE.queue.length);
  });

  it("scenario 24: editor Pin sends onNodes with the selected node ids", () => {
    const onNodes = vi.fn().mockResolvedValue(undefined);
    render(<MemoryGraphV2 tour={false} onNodes={onNodes} />);
    fireEvent.click(screen.getByRole("button", { name: /Graph editor/ }));
    fireEvent.click(screen.getByRole("button", { name: `Select ${SAMPLE.nodes[3].claim}` }));
    fireEvent.click(screen.getByRole("button", { name: "Pin" }));
    expect(onNodes).toHaveBeenCalledWith("pin", [SAMPLE.nodes[3].id]);
  });

  it("scenario 24: editor Prune sends onNodes with the selected node ids", () => {
    const onNodes = vi.fn().mockResolvedValue(undefined);
    render(<MemoryGraphV2 tour={false} onNodes={onNodes} />);
    fireEvent.click(screen.getByRole("button", { name: /Graph editor/ }));
    fireEvent.click(screen.getByRole("button", { name: `Select ${SAMPLE.nodes[5].claim}` }));
    fireEvent.click(screen.getByRole("button", { name: "Prune" }));
    expect(onNodes).toHaveBeenCalledWith("prune", [SAMPLE.nodes[5].id]);
  });

  it("scenario 24: editor Merge with fewer than two rows selected does not call onNodes", () => {
    const onNodes = vi.fn().mockResolvedValue(undefined);
    render(<MemoryGraphV2 tour={false} onNodes={onNodes} />);
    fireEvent.click(screen.getByRole("button", { name: /Graph editor/ }));
    fireEvent.click(screen.getByRole("button", { name: `Select ${SAMPLE.nodes[0].claim}` }));
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    expect(onNodes).not.toHaveBeenCalled();
    expect(screen.getByTestId("mg-toast")).toHaveTextContent("Merging needs two or more rows.");
  });

  it("scenario 25: palette 'Confirm all unreviewed nodes' calls onNodes with every queue id", () => {
    const onNodes = vi.fn().mockResolvedValue(undefined);
    render(<MemoryGraphV2 tour={false} onNodes={onNodes} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const palette = screen.getByTestId("mg-palette");
    fireEvent.change(within(palette).getByRole("textbox"), { target: { value: "confirm all" } });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onNodes).toHaveBeenCalledWith("confirm", SAMPLE.queue.map((q) => q.id));
  });
});

describe("settings: onSettings prop (injection controls)", () => {
  const baseInject = {
    budget: "6k" as const,
    kinds: [...KINDS],
    minWeight: 30,
    decay: "30 days" as const,
    injectedCount: 0,
  };

  beforeEach(() => {
    installLocalStorage();
    window.scrollTo = vi.fn();
  });

  it("scenario 26: budget pill clicks call onSettings with inject_budget_tokens for each tier", () => {
    const onSettings = vi.fn().mockResolvedValue(undefined);
    render(<MemoryGraphV2 tour={false} onSettings={onSettings} />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    fireEvent.click(screen.getByText("2k"));
    expect(onSettings).toHaveBeenCalledWith({ inject_budget_tokens: "2000" });
    fireEvent.click(screen.getByText("6k"));
    expect(onSettings).toHaveBeenCalledWith({ inject_budget_tokens: "6000" });
    fireEvent.click(screen.getByText("12k"));
    expect(onSettings).toHaveBeenCalledWith({ inject_budget_tokens: "12000" });
    fireEvent.click(screen.getByText("No cap"));
    expect(onSettings).toHaveBeenCalledWith({ inject_budget_tokens: "1000000" });
  });

  it("scenario 26: decay card clicks call onSettings with decay_half_life_days for each option", () => {
    const onSettings = vi.fn().mockResolvedValue(undefined);
    render(<MemoryGraphV2 tour={false} onSettings={onSettings} />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    fireEvent.click(screen.getByText("Off"));
    expect(onSettings).toHaveBeenCalledWith({ decay_half_life_days: "0" });
    fireEvent.click(screen.getByText("90 days"));
    expect(onSettings).toHaveBeenCalledWith({ decay_half_life_days: "90" });
    fireEvent.click(screen.getByText("30 days"));
    expect(onSettings).toHaveBeenCalledWith({ decay_half_life_days: "30" });
    fireEvent.click(screen.getByText("7 days"));
    expect(onSettings).toHaveBeenCalledWith({ decay_half_life_days: "7" });
  });

  it("scenario 26: toggling a kind pill off calls onSettings with the remaining kinds in the five-kind order", () => {
    const onSettings = vi.fn().mockResolvedValue(undefined);
    const data = { ...SAMPLE, inject: baseInject };
    render(<MemoryGraphV2 tour={false} data={data} onSettings={onSettings} />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    fireEvent.click(screen.getByText("Constraint"));
    expect(onSettings).toHaveBeenCalledWith({
      inject_kinds: KINDS.filter((k) => k !== "Constraint").join(","),
    });
  });

  it("scenario 26: toggling the last remaining kind pill off sends the full kind list, never an empty string", () => {
    const onSettings = vi.fn().mockResolvedValue(undefined);
    const data = { ...SAMPLE, inject: baseInject };
    render(<MemoryGraphV2 tour={false} data={data} onSettings={onSettings} />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    for (const kind of KINDS.slice(0, 4)) {
      fireEvent.click(screen.getByText(kind));
    }
    onSettings.mockClear();
    fireEvent.click(screen.getByText(KINDS[4]));
    expect(onSettings).toHaveBeenCalledWith({ inject_kinds: KINDS.join(",") });
  });

  it("scenario 27: the minimum-weight slider updates its displayed value on change but only calls onSettings on pointerup", () => {
    const onSettings = vi.fn().mockResolvedValue(undefined);
    render(<MemoryGraphV2 tour={false} onSettings={onSettings} />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "35" } });
    expect(onSettings).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(onSettings).toHaveBeenCalledWith({ inject_min_weight: "0.35" });
  });

  it("scenario 27: the minimum-weight slider also calls onSettings on keyup", () => {
    const onSettings = vi.fn().mockResolvedValue(undefined);
    render(<MemoryGraphV2 tour={false} onSettings={onSettings} />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "42" } });
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    expect(onSettings).toHaveBeenCalledWith({ inject_min_weight: "0.42" });
  });

  it("scenario 28: initial pill, card and slider state comes from data.inject", () => {
    const data = {
      ...SAMPLE,
      inject: {
        budget: "12k" as const,
        kinds: KINDS.filter((k) => k !== "Constraint"),
        minWeight: 55,
        decay: "7 days" as const,
        injectedCount: 3,
      },
    };
    render(<MemoryGraphV2 tour={false} data={data} />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    expect(screen.getByText("12k").closest('[class*="mg-pill"]')).toHaveClass("mg-pill--on");
    expect(screen.getByText("7 days").closest("button")).toHaveClass("mg-decay--on");
    expect(screen.getByText("Constraint").closest('[class*="mg-pill"]')).not.toHaveClass("mg-pill--on");
    expect(screen.getByRole("slider")).toHaveValue("55");
  });

  it("scenario 29: shows how many nodes were injected into the last brief when data.inject is present", () => {
    const data = { ...SAMPLE, inject: { ...baseInject, injectedCount: 4 } };
    render(<MemoryGraphV2 tour={false} data={data} />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    expect(
      screen.getByText(/(\d+) nodes? (was|were) injected into the last brief/)
    ).toBeInTheDocument();
  });
});

describe("sample mode regression (scenario 30)", () => {
  beforeEach(() => {
    installLocalStorage();
    window.scrollTo = vi.fn();
  });

  it("without onNodes/onSettings, confirming a queue item still updates local state and removes the row as before", () => {
    mount();
    const rows = screen.getAllByTestId("mg-queue-row");
    fireEvent.click(within(rows[0]).getByText("Confirm"));
    expect(screen.getAllByTestId("mg-queue-row")).toHaveLength(SAMPLE.queue.length - 1);
  });

  it("without onSettings, budget pills still toggle locally", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    fireEvent.click(screen.getByText("12k"));
    expect(screen.getByText("12k").closest('[class*="mg-pill"]')).toHaveClass("mg-pill--on");
  });
});

describe("live mode: write hygiene (review regressions)", () => {
  beforeEach(() => {
    installLocalStorage();
    window.scrollTo = vi.fn();
  });

  it("does not send a second node write while one is in flight", async () => {
    let release: () => void = () => {};
    const onNodes = vi.fn(() => new Promise<void>((r) => { release = r; }));
    render(<MemoryGraphV2 tour={false} onNodes={onNodes} />);
    fireEvent.keyDown(window, { key: "c" });
    fireEvent.keyDown(window, { key: "c" });
    fireEvent.keyDown(window, { key: "r" });
    expect(onNodes).toHaveBeenCalledTimes(1);
    release();
    await screen.findByTestId("mg-toast");
    fireEvent.keyDown(window, { key: "c" });
    expect(onNodes).toHaveBeenCalledTimes(2);
  });

  it("puts a settings pill back to the server value when the write fails", async () => {
    const onSettings = vi.fn(() => Promise.reject(new Error("disk full")));
    const data = { ...SAMPLE, inject: { ...SAMPLE.inject, budget: "6k" as const } };
    render(<MemoryGraphV2 tour={false} data={data} onSettings={onSettings} />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    fireEvent.click(screen.getByRole("button", { name: "12k" }));
    expect(screen.getByRole("button", { name: "12k" })).toHaveClass("mg-pill--on");
    await screen.findByTestId("mg-toast");
    expect(screen.getByTestId("mg-toast")).toHaveTextContent("Could not save");
    expect(screen.getByRole("button", { name: "6k" })).toHaveClass("mg-pill--on");
    expect(screen.getByRole("button", { name: "12k" })).not.toHaveClass("mg-pill--on");
  });

  it("commits the slider on arrow keys but not on Tab", () => {
    const onSettings = vi.fn(() => Promise.resolve());
    render(<MemoryGraphV2 tour={false} onSettings={onSettings} />);
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    const slider = screen.getByRole("slider");
    fireEvent.keyUp(slider, { key: "Tab" });
    expect(onSettings).not.toHaveBeenCalled();
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});
