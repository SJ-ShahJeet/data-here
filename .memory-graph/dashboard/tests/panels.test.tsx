// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { KnowsPanel } from "@/components/panels/KnowsPanel";
import { TimelinePanel } from "@/components/panels/TimelinePanel";
import { GraphPanel } from "@/components/panels/GraphPanel";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { TiersPanel } from "@/components/panels/TiersPanel";
import { AgentsPanel } from "@/components/panels/AgentsPanel";
import { CompressionPanel } from "@/components/panels/CompressionPanel";
import { PipelinePanel } from "@/components/panels/PipelinePanel";
import { GraphFreshnessPanel } from "@/components/panels/GraphFreshnessPanel";
import type { StateYaml, Sessions, Graph, Settings, Tiers, Agents, Compression, Pipeline, GraphFreshness } from "@/lib/scan/index";

describe("Panel Components", () => {
  afterEach(() => {
    cleanup();
  });

  describe("KnowsPanel", () => {
    it("renders section with data-testid panel-knows", () => {
      const data: StateYaml = {
        present: false,
        updated: null,
        sessions_active: null,
        open: [],
        blocked: [],
        god_nodes_recent: [],
        recent_context: [],
      };

      const { getByTestId } = render(<KnowsPanel data={data} />);
      const section = getByTestId("panel-knows");

      expect(section).toBeTruthy();
      expect(section.tagName).toBe("SECTION");
    });

    it("renders h2 with What it knows now", () => {
      const data: StateYaml = {
        present: false,
        updated: null,
        sessions_active: null,
        open: [],
        blocked: [],
        god_nodes_recent: [],
        recent_context: [],
      };

      const { container } = render(<KnowsPanel data={data} />);
      const h2 = container.querySelector("h2");

      expect(h2?.textContent).toBe("What it knows now");
    });

    it("renders empty state when data absent", () => {
      const data: StateYaml = {
        present: false,
        updated: null,
        sessions_active: null,
        open: [],
        blocked: [],
        god_nodes_recent: [],
        recent_context: [],
      };

      const { getByTestId } = render(<KnowsPanel data={data} />);
      const empty = getByTestId("panel-empty");

      expect(empty.textContent).toBe("No memory yet — finish a session to populate state.yaml");
    });

    it("renders empty state when all arrays empty", () => {
      const data: StateYaml = {
        present: true,
        updated: "2026-08-07",
        sessions_active: 1,
        open: [],
        blocked: [],
        god_nodes_recent: [],
        recent_context: [],
      };

      const { getByTestId } = render(<KnowsPanel data={data} />);
      const empty = getByTestId("panel-empty");

      expect(empty).toBeTruthy();
    });

    it("has data-severity neutral", () => {
      const data: StateYaml = {
        present: false,
        updated: null,
        sessions_active: null,
        open: [],
        blocked: [],
        god_nodes_recent: [],
        recent_context: [],
      };

      const { getByTestId } = render(<KnowsPanel data={data} />);
      const section = getByTestId("panel-knows");

      expect(section.getAttribute("data-severity")).toBe("neutral");
    });
  });

  describe("TimelinePanel", () => {
    it("renders section with data-testid panel-timeline", () => {
      const data: Sessions = {
        present: false,
        count: 0,
        items: [],
      };

      const { getByTestId } = render(<TimelinePanel data={data} />);
      const section = getByTestId("panel-timeline");

      expect(section).toBeTruthy();
      expect(section.tagName).toBe("SECTION");
    });

    it("renders h2 with Session timeline", () => {
      const data: Sessions = {
        present: false,
        count: 0,
        items: [],
      };

      const { container } = render(<TimelinePanel data={data} />);
      const h2 = container.querySelector("h2");

      expect(h2?.textContent).toBe("Session timeline");
    });

    it("renders empty state when no sessions", () => {
      const data: Sessions = {
        present: false,
        count: 0,
        items: [],
      };

      const { getByTestId } = render(<TimelinePanel data={data} />);
      const empty = getByTestId("panel-empty");

      expect(empty.textContent).toBe("No sessions recorded yet");
    });

    it("has data-severity neutral", () => {
      const data: Sessions = {
        present: false,
        count: 0,
        items: [],
      };

      const { getByTestId } = render(<TimelinePanel data={data} />);
      const section = getByTestId("panel-timeline");

      expect(section.getAttribute("data-severity")).toBe("neutral");
    });
  });

  describe("GraphPanel", () => {
    it("renders section with data-testid panel-graph", () => {
      const data: Graph = {
        present: false,
        node_count: 0,
        link_count: 0,
        truncated: false,
        nodes: [],
        links: [],
      };

      const { getByTestId } = render(<GraphPanel data={data} />);
      const section = getByTestId("panel-graph");

      expect(section).toBeTruthy();
      expect(section.tagName).toBe("SECTION");
    });

    it("renders h2 with Code graph", () => {
      const data: Graph = {
        present: false,
        node_count: 0,
        link_count: 0,
        truncated: false,
        nodes: [],
        links: [],
      };

      const { container } = render(<GraphPanel data={data} />);
      const h2 = container.querySelector("h2");

      expect(h2?.textContent).toBe("Code graph");
    });

    it("renders empty state when no graph", () => {
      const data: Graph = {
        present: false,
        node_count: 0,
        link_count: 0,
        truncated: false,
        nodes: [],
        links: [],
      };

      const { getByTestId } = render(<GraphPanel data={data} />);
      const empty = getByTestId("panel-empty");

      expect(empty.textContent).toBe("No graph built — run /graphify . once");
    });

    it("has data-severity neutral", () => {
      const data: Graph = {
        present: false,
        node_count: 0,
        link_count: 0,
        truncated: false,
        nodes: [],
        links: [],
      };

      const { getByTestId } = render(<GraphPanel data={data} />);
      const section = getByTestId("panel-graph");

      expect(section.getAttribute("data-severity")).toBe("neutral");
    });
  });

  describe("SettingsPanel", () => {
    it("renders section with data-testid panel-settings", () => {
      const data: Settings = {
        profile: "standard",
        track: "auto",
        config: {},
        env_overrides: {},
      };

      const { getByTestId } = render(<SettingsPanel data={data} />);
      const section = getByTestId("panel-settings");

      expect(section).toBeTruthy();
      expect(section.tagName).toBe("SECTION");
    });

    it("renders h2 with Settings & commands", () => {
      const data: Settings = {
        profile: "standard",
        track: "auto",
        config: {},
        env_overrides: {},
      };

      const { container } = render(<SettingsPanel data={data} />);
      const h2 = container.querySelector("h2");

      expect(h2?.textContent).toBe("Settings & commands");
    });

    it("renders empty state when no config", () => {
      const data: Settings = {
        profile: "standard",
        track: "auto",
        config: {},
        env_overrides: {},
      };

      const { getByTestId } = render(<SettingsPanel data={data} />);
      const empty = getByTestId("panel-empty");

      expect(empty.textContent).toBe("No settings data");
    });

    it("has data-severity neutral", () => {
      const data: Settings = {
        profile: "standard",
        track: "auto",
        config: {},
        env_overrides: {},
      };

      const { getByTestId } = render(<SettingsPanel data={data} />);
      const section = getByTestId("panel-settings");

      expect(section.getAttribute("data-severity")).toBe("neutral");
    });
  });

  describe("TiersPanel", () => {
    it("renders section with data-testid panel-tiers", () => {
      const data: Tiers = {
        hot: { present: false, bytes: 0, path: "memory/state.yaml" },
        warm: { count: 0, bytes: 0, path: "sessions/" },
        cold: { count: 0, bytes: 0, path: "sessions/archive/" },
        brief: { present: false, bytes: 0, path: "memory/.agent-brief.yaml" },
      };

      const { getByTestId } = render(<TiersPanel data={data} />);
      const section = getByTestId("panel-tiers");

      expect(section).toBeTruthy();
      expect(section.tagName).toBe("SECTION");
    });

    it("renders h2 with Tier breakdown", () => {
      const data: Tiers = {
        hot: { present: false, bytes: 0, path: "memory/state.yaml" },
        warm: { count: 0, bytes: 0, path: "sessions/" },
        cold: { count: 0, bytes: 0, path: "sessions/archive/" },
        brief: { present: false, bytes: 0, path: "memory/.agent-brief.yaml" },
      };

      const { container } = render(<TiersPanel data={data} />);
      const h2 = container.querySelector("h2");

      expect(h2?.textContent).toBe("Tier breakdown");
    });

    it("renders empty state when all tiers empty", () => {
      const data: Tiers = {
        hot: { present: false, bytes: 0, path: "memory/state.yaml" },
        warm: { count: 0, bytes: 0, path: "sessions/" },
        cold: { count: 0, bytes: 0, path: "sessions/archive/" },
        brief: { present: false, bytes: 0, path: "memory/.agent-brief.yaml" },
      };

      const { getByTestId } = render(<TiersPanel data={data} />);
      const empty = getByTestId("panel-empty");

      expect(empty.textContent).toBe("No tier data");
    });

    it("has data-severity neutral", () => {
      const data: Tiers = {
        hot: { present: false, bytes: 0, path: "memory/state.yaml" },
        warm: { count: 0, bytes: 0, path: "sessions/" },
        cold: { count: 0, bytes: 0, path: "sessions/archive/" },
        brief: { present: false, bytes: 0, path: "memory/.agent-brief.yaml" },
      };

      const { getByTestId } = render(<TiersPanel data={data} />);
      const section = getByTestId("panel-tiers");

      expect(section.getAttribute("data-severity")).toBe("neutral");
    });
  });

  describe("AgentsPanel", () => {
    it("renders section with data-testid panel-agents", () => {
      const data: Agents = {
        hosts: [
          {
            name: "cursor",
            installed: false,
            brief: ".cursor/rules/main.mdc",
            brief_present: false,
            brief_mtime: null,
          },
          {
            name: "claude",
            installed: false,
            brief: "CLAUDE.md",
            brief_present: false,
            brief_mtime: null,
          },
          {
            name: "copilot",
            installed: false,
            brief: ".github/copilot-instructions.md",
            brief_present: false,
            brief_mtime: null,
          },
        ],
      };

      const { getByTestId } = render(<AgentsPanel data={data} />);
      const section = getByTestId("panel-agents");

      expect(section).toBeTruthy();
      expect(section.tagName).toBe("SECTION");
    });

    it("renders h2 with Agents", () => {
      const data: Agents = {
        hosts: [
          {
            name: "cursor",
            installed: false,
            brief: ".cursor/rules/main.mdc",
            brief_present: false,
            brief_mtime: null,
          },
          {
            name: "claude",
            installed: false,
            brief: "CLAUDE.md",
            brief_present: false,
            brief_mtime: null,
          },
          {
            name: "copilot",
            installed: false,
            brief: ".github/copilot-instructions.md",
            brief_present: false,
            brief_mtime: null,
          },
        ],
      };

      const { container } = render(<AgentsPanel data={data} />);
      const h2 = container.querySelector("h2");

      expect(h2?.textContent).toBe("Agents");
    });

    it("always renders all three hosts (no empty state)", () => {
      const data: Agents = {
        hosts: [
          {
            name: "cursor",
            installed: false,
            brief: ".cursor/rules/main.mdc",
            brief_present: false,
            brief_mtime: null,
          },
          {
            name: "claude",
            installed: false,
            brief: "CLAUDE.md",
            brief_present: false,
            brief_mtime: null,
          },
          {
            name: "copilot",
            installed: false,
            brief: ".github/copilot-instructions.md",
            brief_present: false,
            brief_mtime: null,
          },
        ],
      };

      const { queryByTestId } = render(<AgentsPanel data={data} />);
      const empty = queryByTestId("panel-empty");

      expect(empty).toBeFalsy();
    });

    it("has data-severity neutral", () => {
      const data: Agents = {
        hosts: [
          {
            name: "cursor",
            installed: false,
            brief: ".cursor/rules/main.mdc",
            brief_present: false,
            brief_mtime: null,
          },
          {
            name: "claude",
            installed: false,
            brief: "CLAUDE.md",
            brief_present: false,
            brief_mtime: null,
          },
          {
            name: "copilot",
            installed: false,
            brief: ".github/copilot-instructions.md",
            brief_present: false,
            brief_mtime: null,
          },
        ],
      };

      const { getByTestId } = render(<AgentsPanel data={data} />);
      const section = getByTestId("panel-agents");

      expect(section.getAttribute("data-severity")).toBe("neutral");
    });
  });

  describe("CompressionPanel", () => {
    it("renders section with data-testid panel-compression", () => {
      const data: Compression = {
        present: false,
        entries: [],
        total_before: 0,
        total_after: 0,
        total_saved: 0,
      };

      const { getByTestId } = render(<CompressionPanel data={data} />);
      const section = getByTestId("panel-compression");

      expect(section).toBeTruthy();
      expect(section.tagName).toBe("SECTION");
    });

    it("renders h2 with Compression history", () => {
      const data: Compression = {
        present: false,
        entries: [],
        total_before: 0,
        total_after: 0,
        total_saved: 0,
      };

      const { container } = render(<CompressionPanel data={data} />);
      const h2 = container.querySelector("h2");

      expect(h2?.textContent).toBe("Compression history");
    });

    it("renders empty state when no ledger", () => {
      const data: Compression = {
        present: false,
        entries: [],
        total_before: 0,
        total_after: 0,
        total_saved: 0,
      };

      const { getByTestId } = render(<CompressionPanel data={data} />);
      const empty = getByTestId("panel-empty");

      expect(empty.textContent).toBe("No compressed tool outputs yet");
    });

    it("has data-severity neutral", () => {
      const data: Compression = {
        present: false,
        entries: [],
        total_before: 0,
        total_after: 0,
        total_saved: 0,
      };

      const { getByTestId } = render(<CompressionPanel data={data} />);
      const section = getByTestId("panel-compression");

      expect(section.getAttribute("data-severity")).toBe("neutral");
    });
  });

  describe("PipelinePanel", () => {
    it("renders section with data-testid panel-pipeline", () => {
      const data: Pipeline = {
        checks: [
          {
            name: "agent_brief",
            path: "memory/.agent-brief-status",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "semantic_pending",
            path: "memory/.semantic-pending",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "semantic_ollama",
            path: "memory/.semantic-ollama-status",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "graph_scout",
            path: "memory/.graph-scout-status",
            present: false,
            mtime: null,
            detail: "",
          },
        ],
      };

      const { getByTestId } = render(<PipelinePanel data={data} />);
      const section = getByTestId("panel-pipeline");

      expect(section).toBeTruthy();
      expect(section.tagName).toBe("SECTION");
    });

    it("renders h2 with Pipeline health", () => {
      const data: Pipeline = {
        checks: [
          {
            name: "agent_brief",
            path: "memory/.agent-brief-status",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "semantic_pending",
            path: "memory/.semantic-pending",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "semantic_ollama",
            path: "memory/.semantic-ollama-status",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "graph_scout",
            path: "memory/.graph-scout-status",
            present: false,
            mtime: null,
            detail: "",
          },
        ],
      };

      const { container } = render(<PipelinePanel data={data} />);
      const h2 = container.querySelector("h2");

      expect(h2?.textContent).toBe("Pipeline health");
    });

    it("renders empty state when no checks present", () => {
      const data: Pipeline = {
        checks: [
          {
            name: "agent_brief",
            path: "memory/.agent-brief-status",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "semantic_pending",
            path: "memory/.semantic-pending",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "semantic_ollama",
            path: "memory/.semantic-ollama-status",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "graph_scout",
            path: "memory/.graph-scout-status",
            present: false,
            mtime: null,
            detail: "",
          },
        ],
      };

      const { getByTestId } = render(<PipelinePanel data={data} />);
      const empty = getByTestId("panel-empty");

      expect(empty.textContent).toBe("No pipeline status files yet");
    });

    it("has data-severity neutral", () => {
      const data: Pipeline = {
        checks: [
          {
            name: "agent_brief",
            path: "memory/.agent-brief-status",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "semantic_pending",
            path: "memory/.semantic-pending",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "semantic_ollama",
            path: "memory/.semantic-ollama-status",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "graph_scout",
            path: "memory/.graph-scout-status",
            present: false,
            mtime: null,
            detail: "",
          },
        ],
      };

      const { getByTestId } = render(<PipelinePanel data={data} />);
      const section = getByTestId("panel-pipeline");

      expect(section.getAttribute("data-severity")).toBe("neutral");
    });
  });

  describe("GraphFreshnessPanel", () => {
    it("renders section with data-testid panel-graph-freshness", () => {
      const data: GraphFreshness = {
        present: false,
        graph_mtime: null,
        last_commit: null,
        behind: null,
      };

      const { getByTestId } = render(<GraphFreshnessPanel data={data} />);
      const section = getByTestId("panel-graph-freshness");

      expect(section).toBeTruthy();
      expect(section.tagName).toBe("SECTION");
    });

    it("renders h2 with Graph freshness", () => {
      const data: GraphFreshness = {
        present: false,
        graph_mtime: null,
        last_commit: null,
        behind: null,
      };

      const { container } = render(<GraphFreshnessPanel data={data} />);
      const h2 = container.querySelector("h2");

      expect(h2?.textContent).toBe("Graph freshness");
    });

    it("renders empty state when no graph", () => {
      const data: GraphFreshness = {
        present: false,
        graph_mtime: null,
        last_commit: null,
        behind: null,
      };

      const { getByTestId } = render(<GraphFreshnessPanel data={data} />);
      const empty = getByTestId("panel-empty");

      expect(empty.textContent).toBe("No graph built — run /graphify . once");
    });

    it("has data-severity neutral", () => {
      const data: GraphFreshness = {
        present: false,
        graph_mtime: null,
        last_commit: null,
        behind: null,
      };

      const { getByTestId } = render(<GraphFreshnessPanel data={data} />);
      const section = getByTestId("panel-graph-freshness");

      expect(section.getAttribute("data-severity")).toBe("neutral");
    });
  });

  describe("all panels have data-severity neutral", () => {
    it("all nine panels render with data-severity neutral", () => {
      const knows: StateYaml = {
        present: false,
        updated: null,
        sessions_active: null,
        open: [],
        blocked: [],
        god_nodes_recent: [],
        recent_context: [],
      };
      const timeline: Sessions = { present: false, count: 0, items: [] };
      const gr: Graph = {
        present: false,
        node_count: 0,
        link_count: 0,
        truncated: false,
        nodes: [],
        links: [],
      };
      const sett: Settings = {
        profile: "standard",
        track: "auto",
        config: {},
        env_overrides: {},
      };
      const trs: Tiers = {
        hot: { present: false, bytes: 0, path: "memory/state.yaml" },
        warm: { count: 0, bytes: 0, path: "sessions/" },
        cold: { count: 0, bytes: 0, path: "sessions/archive/" },
        brief: { present: false, bytes: 0, path: "memory/.agent-brief.yaml" },
      };
      const ags: Agents = {
        hosts: [
          {
            name: "cursor",
            installed: false,
            brief: ".cursor/rules/main.mdc",
            brief_present: false,
            brief_mtime: null,
          },
          {
            name: "claude",
            installed: false,
            brief: "CLAUDE.md",
            brief_present: false,
            brief_mtime: null,
          },
          {
            name: "copilot",
            installed: false,
            brief: ".github/copilot-instructions.md",
            brief_present: false,
            brief_mtime: null,
          },
        ],
      };
      const cmp: Compression = {
        present: false,
        entries: [],
        total_before: 0,
        total_after: 0,
        total_saved: 0,
      };
      const pipe: Pipeline = {
        checks: [
          {
            name: "agent_brief",
            path: "memory/.agent-brief-status",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "semantic_pending",
            path: "memory/.semantic-pending",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "semantic_ollama",
            path: "memory/.semantic-ollama-status",
            present: false,
            mtime: null,
            detail: "",
          },
          {
            name: "graph_scout",
            path: "memory/.graph-scout-status",
            present: false,
            mtime: null,
            detail: "",
          },
        ],
      };
      const gf: GraphFreshness = {
        present: false,
        graph_mtime: null,
        last_commit: null,
        behind: null,
      };

      const { container: kc } = render(<KnowsPanel data={knows} />);
      const { container: tc } = render(<TimelinePanel data={timeline} />);
      const { container: gc } = render(<GraphPanel data={gr} />);
      const { container: sc } = render(<SettingsPanel data={sett} />);
      const { container: tirc } = render(<TiersPanel data={trs} />);
      const { container: ac } = render(<AgentsPanel data={ags} />);
      const { container: cc } = render(<CompressionPanel data={cmp} />);
      const { container: pc } = render(<PipelinePanel data={pipe} />);
      const { container: gfc } = render(<GraphFreshnessPanel data={gf} />);

      [kc, tc, gc, sc, tirc, ac, cc, pc, gfc].forEach((container) => {
        const section = container.querySelector("section");
        expect(section?.getAttribute("data-severity")).toBe("neutral");
      });
    });
  });
});
