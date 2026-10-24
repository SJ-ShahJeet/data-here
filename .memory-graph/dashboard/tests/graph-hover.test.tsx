// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GraphPanel } from "../components/panels/GraphPanel";
import { GRAPH_FIXTURE, stubMatchMedia } from "./sandbox";

describe("GraphPanel hover dimming", () => {
  let matchMediaStub: ReturnType<typeof stubMatchMedia>;

  afterEach(() => {
    cleanup();
    if (matchMediaStub) {
      matchMediaStub.restore();
    }
  });

  it("renders graph panel with testid", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GraphPanel data={GRAPH_FIXTURE} />);
    expect(screen.getByTestId("panel-graph")).not.toBeNull();
  });

  it("renders all nodes as rows", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GraphPanel data={GRAPH_FIXTURE} />);
    const rows = screen.getAllByTestId("graph-row");
    expect(rows.length).toBe(GRAPH_FIXTURE.nodes.length);
  });

  it("sets data-node-id on each row", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GraphPanel data={GRAPH_FIXTURE} />);
    const rows = screen.getAllByTestId("graph-row");
    rows.forEach((row, i) => {
      expect(row.getAttribute("data-node-id")).toBe(GRAPH_FIXTURE.nodes[i].id);
    });
  });

  it("starts with all rows data-dimmed=false", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GraphPanel data={GRAPH_FIXTURE} />);
    const rows = screen.getAllByTestId("graph-row");
    rows.forEach((row) => {
      expect(row.getAttribute("data-dimmed")).toBe("false");
    });
  });

  it("dims non-neighbour rows on hover", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GraphPanel data={GRAPH_FIXTURE} />);
    const rows = screen.getAllByTestId("graph-row");

    // GRAPH_FIXTURE: A->B->C, so A's neighbours are {A, B}
    fireEvent.mouseEnter(rows[0]);

    // Row A (index 0) is not dimmed
    expect(rows[0].getAttribute("data-dimmed")).toBe("false");
    // Row B (index 1, neighbour of A) is not dimmed
    expect(rows[1].getAttribute("data-dimmed")).toBe("false");
    // Row C (index 2, not neighbour) is dimmed
    expect(rows[2].getAttribute("data-dimmed")).toBe("true");
  });

  it("includes node itself in neighbours", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GraphPanel data={GRAPH_FIXTURE} />);
    const rows = screen.getAllByTestId("graph-row");

    fireEvent.mouseEnter(rows[0]);
    // The hovered node itself should not be dimmed
    expect(rows[0].getAttribute("data-dimmed")).toBe("false");
  });

  it("includes direct link neighbours", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GraphPanel data={GRAPH_FIXTURE} />);
    const rows = screen.getAllByTestId("graph-row");

    // A links to B
    fireEvent.mouseEnter(rows[0]);
    expect(rows[1].getAttribute("data-dimmed")).toBe("false");

    fireEvent.mouseLeave(rows[0]);

    // B links to C
    fireEvent.mouseEnter(rows[1]);
    expect(rows[2].getAttribute("data-dimmed")).toBe("false");
  });

  it("handles bidirectional links", () => {
    matchMediaStub = stubMatchMedia(false);
    const dataWithBilink = {
      ...GRAPH_FIXTURE,
      links: [
        { source: "A", target: "B" },
        { source: "B", target: "A" }, // Reverse link
      ],
    };

    render(<GraphPanel data={dataWithBilink} />);
    const rows = screen.getAllByTestId("graph-row");

    fireEvent.mouseEnter(rows[0]);
    expect(rows[1].getAttribute("data-dimmed")).toBe("false");
  });

  it("resets dimming on mouse leave", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GraphPanel data={GRAPH_FIXTURE} />);
    const rows = screen.getAllByTestId("graph-row");

    fireEvent.mouseEnter(rows[0]);
    fireEvent.mouseLeave(rows[0]);

    rows.forEach((row) => {
      expect(row.getAttribute("data-dimmed")).toBe("false");
    });
  });

  it("supports switching hover between nodes", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GraphPanel data={GRAPH_FIXTURE} />);
    const rows = screen.getAllByTestId("graph-row");

    fireEvent.mouseEnter(rows[0]);
    expect(rows[2].getAttribute("data-dimmed")).toBe("true");

    fireEvent.mouseEnter(rows[2]);
    expect(rows[0].getAttribute("data-dimmed")).toBe("true");
  });

  it("maintains dimming logic when reduced-motion is set", () => {
    matchMediaStub = stubMatchMedia(true);
    render(<GraphPanel data={GRAPH_FIXTURE} />);
    const rows = screen.getAllByTestId("graph-row");

    fireEvent.mouseEnter(rows[0]);
    // Dimming still works, but transition is removed
    expect(rows[0].getAttribute("data-dimmed")).toBe("false");
    expect(rows[2].getAttribute("data-dimmed")).toBe("true");
  });

  it("handles node with no links", () => {
    matchMediaStub = stubMatchMedia(false);
    const dataWithIsolated = {
      ...GRAPH_FIXTURE,
      node_count: GRAPH_FIXTURE.node_count + 1,
      nodes: [
        ...GRAPH_FIXTURE.nodes,
        { id: "D", label: "Isolated", community: null, type: "other", degree: 0, betweenness: null },
      ],
      links: GRAPH_FIXTURE.links,
    };

    render(<GraphPanel data={dataWithIsolated} />);
    const rows = screen.getAllByTestId("graph-row");

    // Hover D (index 3, isolated)
    fireEvent.mouseEnter(rows[3]);

    // D should not be dimmed, all others should be
    expect(rows[3].getAttribute("data-dimmed")).toBe("false");
    expect(rows[0].getAttribute("data-dimmed")).toBe("true");
    expect(rows[1].getAttribute("data-dimmed")).toBe("true");
    expect(rows[2].getAttribute("data-dimmed")).toBe("true");
  });

  it("handles node with multiple connections", () => {
    matchMediaStub = stubMatchMedia(false);
    const dataWithHub = {
      ...GRAPH_FIXTURE,
      nodes: GRAPH_FIXTURE.nodes,
      links: [
        { source: "A", target: "B" },
        { source: "A", target: "C" },
        { source: "B", target: "C" },
      ],
    };

    render(<GraphPanel data={dataWithHub} />);
    const rows = screen.getAllByTestId("graph-row");

    // A is linked to both B and C
    fireEvent.mouseEnter(rows[0]);
    expect(rows[1].getAttribute("data-dimmed")).toBe("false");
    expect(rows[2].getAttribute("data-dimmed")).toBe("false");
  });

  it("preserves graph structure from slice 2", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GraphPanel data={GRAPH_FIXTURE} />);
    expect(screen.getByText("Code graph")).not.toBeNull();
  });

  it("has severity=neutral", () => {
    matchMediaStub = stubMatchMedia(false);
    render(<GraphPanel data={GRAPH_FIXTURE} />);
    // GraphPanel's own root <section> carries data-severity directly — per
    // the slice-2 contract this component is kept unchanged ("same
    // data-severity=neutral"), it is not wrapped in a Card by GraphPanel
    // itself, so the assertion targets panel-graph, not its parentElement.
    expect(screen.getByTestId("panel-graph").getAttribute("data-severity")).toBe(
      "neutral"
    );
  });
});
