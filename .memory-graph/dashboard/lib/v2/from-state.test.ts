import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { collect } from "@/lib/scan";
import { fromState } from "@/lib/v2/from-state";
import { ACCENT, KIND_COLOR, KINDS, TOUR } from "@/lib/v2/constants";
import type { Screen } from "@/lib/v2/types";
import { makeSandbox, type Sandbox } from "@/tests/sandbox";
import { SAMPLE } from "@/lib/v2/sample";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE_TSX = path.resolve(__dirname, "..", "..", "app", "v2", "page.tsx");

const VALID_SCREENS: Screen[] = [
  "overview",
  "sessions",
  "editor",
  "fleet",
  "commands",
  "settings",
  "setup",
];

describe("fromState", () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = makeSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  describe("queue (scenario 7)", () => {
    it("contains only unreviewed live nodes, heaviest first, with exact meta and source strings", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({
          nodes: [
            {
              id: "n1",
              claim: "claim A",
              kind: "Constraint",
              status: "unreviewed",
              weight: 0.61,
              base_weight: 0.5,
              last_seen: "2026-08-07T10:00:00Z",
              source_session: "sessions/2026-08-07-1.md",
            },
            {
              id: "n2",
              claim: "claim B",
              kind: "Dependency",
              status: "unreviewed",
              weight: 0.9,
              base_weight: 0.5,
              last_seen: "2026-08-06T09:00:00Z",
              source_session: "sessions/2026-08-06-1.md",
            },
            {
              id: "n3",
              claim: "claim C",
              kind: "Decision",
              status: "confirmed",
              weight: 0.99,
              base_weight: 0.5,
              last_seen: "2026-08-05T09:00:00Z",
              source_session: "sessions/2026-08-05-1.md",
            },
          ],
        })
      );

      const data = fromState(collect(sandbox.root));

      expect(data.queue).toEqual([
        {
          id: "n2",
          kind: "Dependency",
          meta: "weight 0.90 · last seen 2026-08-06T09:00:00Z",
          claim: "claim B",
          source: "from sessions/2026-08-06-1.md",
        },
        {
          id: "n1",
          kind: "Constraint",
          meta: "weight 0.61 · last seen 2026-08-07T10:00:00Z",
          claim: "claim A",
          source: "from sessions/2026-08-07-1.md",
        },
      ]);
    });
  });

  describe("live filtering excludes rejected and merged_into (scenario 8)", () => {
    it("keeps rejected and merged_into nodes out of queue, weights, nodes and kinds counts", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({
          nodes: [
            {
              id: "n1",
              claim: "rejected claim",
              kind: "Decision",
              status: "rejected",
              weight: 0.99,
              base_weight: 0.9,
              last_seen: "2026-08-07",
              source_session: "s1",
            },
            {
              id: "n2",
              claim: "merged claim",
              kind: "Decision",
              status: "merged_into",
              weight: 0.95,
              base_weight: 0.9,
              last_seen: "2026-08-07",
              source_session: "s1",
            },
            {
              id: "n3",
              claim: "live claim",
              kind: "Decision",
              status: "confirmed",
              weight: 0.5,
              base_weight: 0.5,
              last_seen: "2026-08-07",
              source_session: "s1",
            },
          ],
        })
      );

      const data = fromState(collect(sandbox.root));

      expect(data.queue).toEqual([]);
      expect(data.weights).toHaveLength(1);
      expect(data.weights[0].label).toBe("live claim");
      expect(data.nodes.map((n) => n.claim)).toEqual(["live claim"]);
      expect(data.kinds.find((k) => k.kind === "Decision")?.count).toBe(1);
      expect(data.kinds.reduce((sum, k) => sum + k.count, 0)).toBe(1);
    });

    it("caps weights at the 6 heaviest live nodes", () => {
      const nodes = Array.from({ length: 8 }, (_, i) => ({
        id: `n${i}`,
        claim: `claim ${i}`,
        kind: "Decision",
        status: "confirmed",
        weight: (i + 1) / 10,
        base_weight: (i + 1) / 20,
        last_seen: "2026-08-07",
        source_session: "s1",
      }));
      sandbox.write("memory/nodes.json", JSON.stringify({ nodes }));

      const data = fromState(collect(sandbox.root));

      expect(data.weights).toHaveLength(6);
      expect(data.weights.map((w) => w.now)).toEqual([0.8, 0.7, 0.6, 0.5, 0.4, 0.3]);
      expect(data.weights[0]).toEqual({ label: "claim 7", kind: "Decision", now: 0.8, then: 0.4 });
    });
  });

  describe("kinds (scenario 9)", () => {
    it("has all five kinds in a fixed order with correct counts, including zeros", () => {
      const mk = (id: string, kind: string) => ({
        id,
        claim: id,
        kind,
        status: "confirmed",
        weight: 0.5,
        base_weight: 0.5,
        last_seen: "x",
        source_session: "s",
      });
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({
          nodes: [
            mk("d1", "Decision"),
            mk("d2", "Decision"),
            mk("o1", "Open thread"),
            mk("t1", "Test/CI fact"),
            mk("t2", "Test/CI fact"),
            mk("t3", "Test/CI fact"),
          ],
        })
      );

      const data = fromState(collect(sandbox.root));

      expect(data.kinds).toEqual([
        { kind: "Decision", count: 2 },
        { kind: "Constraint", count: 0 },
        { kind: "Open thread", count: 1 },
        { kind: "Dependency", count: 0 },
        { kind: "Test/CI fact", count: 3 },
      ]);
    });
  });

  describe("metrics (scenario 10)", () => {
    it("orders metrics Sessions, Nodes, Reviewed, Context hit rate, Tokens saved with an empty spark on every metric", () => {
      const data = fromState(collect(sandbox.root));

      expect(data.metrics.map((m) => m.label)).toEqual([
        "Sessions",
        "Nodes",
        "Reviewed",
        "Context hit rate",
        "Tokens saved",
      ]);
      data.metrics.forEach((m) => expect(m.spark).toEqual([]));
    });

    it("shows Reviewed as '—' and 0 unreviewed nodes when there are no live nodes", () => {
      const data = fromState(collect(sandbox.root));

      expect(data.metrics.find((m) => m.label === "Reviewed")!.value).toBe("—");
      expect(data.metrics.find((m) => m.label === "Nodes")!.note).toBe("0 unreviewed");
    });

    it("shows Reviewed as '50%' with one confirmed and one unreviewed live node", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({
          nodes: [
            {
              id: "n1",
              claim: "c1",
              kind: "Decision",
              status: "confirmed",
              weight: 0.5,
              base_weight: 0.5,
              last_seen: "x",
              source_session: "s",
            },
            {
              id: "n2",
              claim: "c2",
              kind: "Decision",
              status: "unreviewed",
              weight: 0.4,
              base_weight: 0.4,
              last_seen: "x",
              source_session: "s",
            },
          ],
        })
      );

      const data = fromState(collect(sandbox.root));

      expect(data.metrics.find((m) => m.label === "Reviewed")!.value).toBe("50%");
      expect(data.metrics.find((m) => m.label === "Nodes")!.value).toBe("2");
      expect(data.metrics.find((m) => m.label === "Nodes")!.note).toBe("1 unreviewed");
    });

    it("formats 0 saved tokens as '0'", () => {
      const data = fromState(collect(sandbox.root));

      expect(data.metrics.find((m) => m.label === "Tokens saved")!.value).toBe("0");
    });

    it("formats 1234 saved tokens as '1.2k'", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        JSON.stringify({ at: "2026-08-07T10:00:00Z", tool: "compress", before: 2000, after: 766 }) + "\n"
      );

      const data = fromState(collect(sandbox.root));

      expect(data.metrics.find((m) => m.label === "Tokens saved")!.value).toBe("1.2k");
    });

    it("formats 4900000 saved tokens as '4.9M'", () => {
      sandbox.write(
        "memory/.compression-log.jsonl",
        JSON.stringify({ at: "2026-08-07T10:00:00Z", tool: "compress", before: 5000000, after: 100000 }) + "\n"
      );

      const data = fromState(collect(sandbox.root));

      expect(data.metrics.find((m) => m.label === "Tokens saved")!.value).toBe("4.9M");
    });
  });

  describe("kind/status fallbacks in the node list (scenario 11)", () => {
    it("maps an unrecognized kind to 'Open thread' and an unrecognized status to 'unreviewed'", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({
          nodes: [
            {
              id: "n1",
              claim: "weird kind",
              kind: "Bug",
              status: "confirmed",
              weight: 0.5,
              base_weight: 0.5,
              last_seen: "x",
              source_session: "s",
            },
            {
              id: "n2",
              claim: "weird status",
              kind: "Decision",
              status: "wip",
              weight: 0.4,
              base_weight: 0.4,
              last_seen: "x",
              source_session: "s",
            },
          ],
        })
      );

      const data = fromState(collect(sandbox.root));

      expect(data.nodes.find((n) => n.claim === "weird kind")!.kind).toBe("Open thread");
      expect(data.nodes.find((n) => n.claim === "weird status")!.status).toBe("unreviewed");
    });
  });

  describe("sessions mapping (scenario 12)", () => {
    it("maps sessions in order, gives only the first item injected reads, and prefixes blocked items", () => {
      sandbox.write(
        "sessions/2026-08-07-1.md",
        `---
date: 2026-08-07
time: "14:02"
topics: "dashboard rebuild"
context: "ported the collectors"
open:
  - "charts"
blocked:
  - "ops review"
---
body`
      );
      sandbox.write(
        "sessions/2026-08-06-1.md",
        `---
date: 2026-08-06
---
`
      );
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({
          nodes: [
            {
              id: "n1",
              claim: "wrote by session1 A",
              kind: "Decision",
              status: "confirmed",
              weight: 0.5,
              base_weight: 0.5,
              last_seen: "x",
              source_session: "sessions/2026-08-07-1.md",
            },
            {
              id: "n2",
              claim: "wrote by session1 B",
              kind: "Constraint",
              status: "confirmed",
              weight: 0.4,
              base_weight: 0.4,
              last_seen: "x",
              source_session: "sessions/2026-08-07-1.md",
            },
            {
              id: "n3",
              claim: "wrote by session2",
              kind: "Dependency",
              status: "confirmed",
              weight: 0.3,
              base_weight: 0.3,
              last_seen: "x",
              source_session: "2026-08-06-1.md",
            },
          ],
        })
      );
      sandbox.write(
        "memory/.brief-injected.json",
        JSON.stringify({ updated: "2026-08-07T09:00:00Z", ids: ["n1", "does-not-exist"] })
      );

      const data = fromState(collect(sandbox.root));

      expect(data.sessions).toHaveLength(2);
      const [first, second] = data.sessions;

      expect(first.id).toBe("2026-08-07-1");
      expect(first.when).toBe("2026-08-07");
      expect(first.title).toBe("dashboard rebuild");
      expect(first.wrote).toBe(2);
      expect(first.stamp).toBe("2026-08-07 14:02");
      expect(first.summary).toBe("ported the collectors");
      expect(first.decided).toEqual(["ported the collectors"]);
      expect(first.open).toEqual(["charts", "blocked: ops review"]);
      expect(first.injected).toBe("—");
      expect(first.saved).toBe("—");
      expect(first.duration).toBe("—");
      expect(first.reads).toEqual([{ kind: "Decision", text: "wrote by session1 A" }]);
      expect(first.read).toBe(1);

      expect(second.id).toBe("2026-08-06-1");
      expect(second.title).toBe("2026-08-06-1.md");
      expect(second.wrote).toBe(1);
      expect(second.decided).toEqual([]);
      expect(second.open).toEqual([]);
      expect(second.stamp).toBe("2026-08-06 ");
      expect(second.reads).toEqual([]);
      expect(second.read).toBe(0);
    });
  });

  describe("repos and fleet (scenario 13)", () => {
    it("produces one self repo entry whose coverage matches the reviewed fraction, and a fleet of 1", () => {
      sandbox.write(
        "memory/nodes.json",
        JSON.stringify({
          nodes: [
            {
              id: "n1",
              claim: "c1",
              kind: "Decision",
              status: "confirmed",
              weight: 0.5,
              base_weight: 0.5,
              last_seen: "x",
              source_session: "s",
            },
            {
              id: "n2",
              claim: "c2",
              kind: "Decision",
              status: "pinned",
              weight: 0.4,
              base_weight: 0.4,
              last_seen: "x",
              source_session: "s",
            },
            {
              id: "n3",
              claim: "c3",
              kind: "Decision",
              status: "stale",
              weight: 0.3,
              base_weight: 0.3,
              last_seen: "x",
              source_session: "s",
            },
            {
              id: "n4",
              claim: "c4",
              kind: "Decision",
              status: "unreviewed",
              weight: 0.2,
              base_weight: 0.2,
              last_seen: "x",
              source_session: "s",
            },
          ],
        })
      );
      sandbox.write(
        "memory/.compression-log.jsonl",
        JSON.stringify({ at: "2026-08-07T10:00:00Z", tool: "compress", before: 5000000, after: 100000 }) + "\n"
      );

      const state = collect(sandbox.root);
      const data = fromState(state);

      expect(data.repos).toHaveLength(1);
      const repo0 = data.repos[0];
      expect(repo0.name).toBe(state.repo);
      expect(repo0.stack).toBe(state.settings.profile);
      expect(repo0.nodes).toBe(4);
      expect(repo0.coverage).toBe(0.5);
      expect(repo0.saved).toBe("4.9M");
      expect(repo0.unreviewed).toBe(1);
      expect(repo0.self).toBe(true);

      expect(data.fleet).toEqual({ repos: 1, saved: "4.9M", medianCoverage: "50%", unreviewed: 1 });
    });
  });

  describe("placeholders and static content (scenario 14)", () => {
    it("fills scan, scanDuration, stack and proposals with fixed placeholders", () => {
      const data = fromState(collect(sandbox.root));

      expect(data.scan).toEqual([
        { text: "$ bash setup --agent=all", tone: "cmd" },
        { text: "setup scan is not wired to the engine yet", tone: "dim" },
      ]);
      expect(data.scanDuration).toBe("—");
      expect(data.stack).toEqual([]);
      expect(data.proposals).toEqual([]);
    });

    it("has a non-empty commands list with no fictional 'memgraph ' cli reference", () => {
      const data = fromState(collect(sandbox.root));
      const cmds = data.commands.flatMap((section) => section.items.map((i) => i.cmd));

      expect(data.commands.length).toBeGreaterThan(0);
      expect(cmds.length).toBeGreaterThan(0);
      expect(cmds.some((cmd) => cmd.includes("memgraph "))).toBe(false);
    });

    it("has a non-empty tour whose steps reference valid screens", () => {
      const data = fromState(collect(sandbox.root));

      expect(data.tour.length).toBeGreaterThan(0);
      expect(data.tour.every((step) => VALID_SCREENS.includes(step.screen))).toBe(true);
    });

    it("gives daemon and connection as non-empty strings that mention the repo", () => {
      const state = collect(sandbox.root);
      const data = fromState(state);

      expect(data.daemon.length).toBeGreaterThan(0);
      expect(data.daemon).toContain(state.repo);
      expect(data.connection.length).toBeGreaterThan(0);
      expect(data.connection).toContain(state.repo);
    });
  });

  describe("no sample data / constants module (scenario 16)", () => {
    it("app/v2/page.tsx does not import from lib/v2/sample", () => {
      const text = readFileSync(PAGE_TSX, "utf-8");
      expect(text).not.toContain("lib/v2/sample");
    });

    it("lib/v2/constants.ts exports ACCENT, KIND_COLOR, KINDS and TOUR", () => {
      expect(ACCENT).toBeDefined();
      expect(KIND_COLOR).toBeDefined();
      expect(KINDS).toBeDefined();
      expect(TOUR).toBeDefined();
    });
  });
});

describe("fromState reads attribution and formatting (review regressions)", () => {
  let sandbox: Sandbox;
  beforeEach(() => { sandbox = makeSandbox(); });
  afterEach(() => { sandbox.cleanup(); });

  const node = (id: string, source: string) => ({
    id, claim: `claim ${id}`, kind: "Decision", status: "unreviewed", weight: 0.5, base_weight: 0.5,
    first_seen: "2026-08-06", last_seen: "2026-08-06", seen_count: 1, source_session: source,
  });
  const session = (date: string, time: string) =>
    `---\ndate: ${date}\ntime: "${time}"\nsession: 1\ntopics: "t"\ncontext: ""\nopen: []\nblocked: []\n---\n`;

  it("attributes injected reads to the first session that started after the brief was written", () => {
    sandbox.write("sessions/2026-08-08-1.md", session("2026-08-08", "09:00"));
    sandbox.write("sessions/2026-08-07-1.md", session("2026-08-07", "14:02"));
    sandbox.write("sessions/2026-08-06-1.md", session("2026-08-06", "10:00"));
    sandbox.write("memory/nodes.json", JSON.stringify({ nodes: [node("n1", "2026-08-06-1.md")], ingested_sessions: [] }));
    sandbox.write("memory/.brief-injected.json", JSON.stringify({ updated: "2026-08-07T12:00:00Z", ids: ["n1"] }));
    const data = fromState(collect(sandbox.root));
    expect(data.sessions.map((s) => s.read)).toEqual([0, 1, 0]);
  });

  it("attributes nothing when the brief is newer than every session (the reader has not started yet)", () => {
    sandbox.write("sessions/2026-08-07-1.md", session("2026-08-07", "14:02"));
    sandbox.write("memory/nodes.json", JSON.stringify({ nodes: [node("n1", "2026-08-07-1.md")], ingested_sessions: [] }));
    sandbox.write("memory/.brief-injected.json", JSON.stringify({ updated: "2026-08-07T15:00:00Z", ids: ["n1"] }));
    const data = fromState(collect(sandbox.root));
    expect(data.sessions[0].read).toBe(0);
    expect(data.sessions[0].wrote).toBe(1);
  });

  it("counts only live nodes in the Nodes metric and repos", () => {
    sandbox.write("memory/nodes.json", JSON.stringify({ nodes: [
      node("n1", "s"), { ...node("n2", "s"), status: "rejected" }, { ...node("n3", "s"), status: "merged_into" },
    ], ingested_sessions: [] }));
    const data = fromState(collect(sandbox.root));
    expect(data.metrics[1].value).toBe("1");
    expect(data.nodeCount).toBe(1);
    expect(data.repos[0].nodes).toBe(1);
  });

  it("rolls 999950 saved tokens into the M range instead of printing 1000.0k", () => {
    sandbox.write("memory/.compression-log.jsonl", `{"at":"x","tool":"t","before":999950,"after":0}\n`);
    expect(fromState(collect(sandbox.root)).metrics[4].value).toBe("1.0M");
    sandbox.write("memory/.compression-log.jsonl", `{"at":"x","tool":"t","before":999949,"after":0}\n`);
    expect(fromState(collect(sandbox.root)).metrics[4].value).toBe("999.9k");
  });
});

describe("live filtering excludes pruned nodes (scenario 15)", () => {
  let sandbox: Sandbox;
  beforeEach(() => { sandbox = makeSandbox(); });
  afterEach(() => { sandbox.cleanup(); });

  it("keeps pruned nodes out of the queue, weights, nodes and kinds counts, like rejected and merged_into", () => {
    sandbox.write(
      "memory/nodes.json",
      JSON.stringify({
        nodes: [
          {
            id: "n1",
            claim: "pruned claim",
            kind: "Decision",
            status: "pruned",
            weight: 0.99,
            base_weight: 0.9,
            last_seen: "2026-08-07",
            source_session: "s1",
          },
          {
            id: "n2",
            claim: "live claim",
            kind: "Decision",
            status: "confirmed",
            weight: 0.5,
            base_weight: 0.5,
            last_seen: "2026-08-07",
            source_session: "s1",
          },
        ],
      })
    );

    const data = fromState(collect(sandbox.root));

    expect(data.queue).toEqual([]);
    expect(data.weights).toHaveLength(1);
    expect(data.weights[0].label).toBe("live claim");
    expect(data.nodes.map((n) => n.claim)).toEqual(["live claim"]);
    expect(data.kinds.find((k) => k.kind === "Decision")?.count).toBe(1);
  });
});

describe("data.inject (scenarios 16-17)", () => {
  let sandbox: Sandbox;
  beforeEach(() => { sandbox = makeSandbox(); });
  afterEach(() => { sandbox.cleanup(); });

  it("defaults to budget 6k, all five kinds, minWeight 30, decay 30 days and injectedCount 0 with no config", () => {
    const data = fromState(collect(sandbox.root));
    expect(data.inject.budget).toBe("6k");
    expect(data.inject.kinds).toEqual(KINDS);
    expect(data.inject.minWeight).toBe(30);
    expect(data.inject.decay).toBe("30 days");
    expect(data.inject.injectedCount).toBe(0);
  });

  it("maps inject_budget_tokens to the correct Budget tier, including the No cap tier above 12000", () => {
    sandbox.write(".memory-graph/config.yaml", "inject_budget_tokens: 12000\n");
    expect(fromState(collect(sandbox.root)).inject.budget).toBe("12k");
    sandbox.write(".memory-graph/config.yaml", "inject_budget_tokens: 1000000\n");
    expect(fromState(collect(sandbox.root)).inject.budget).toBe("No cap");
  });

  it("normalises inject_kinds to the five-kind canonical order and spelling, case-insensitively", () => {
    sandbox.write(".memory-graph/config.yaml", 'inject_kinds: "constraint, Decision"\n');
    expect(fromState(collect(sandbox.root)).inject.kinds).toEqual(["Decision", "Constraint"]);
  });

  it("rounds inject_min_weight to a 0..100 integer", () => {
    sandbox.write(".memory-graph/config.yaml", "inject_min_weight: 0.35\n");
    expect(fromState(collect(sandbox.root)).inject.minWeight).toBe(35);
  });

  it("maps decay_half_life_days to the correct Decay tier for 0, 90 and 7", () => {
    sandbox.write(".memory-graph/config.yaml", "decay_half_life_days: 0\n");
    expect(fromState(collect(sandbox.root)).inject.decay).toBe("Off");
    sandbox.write(".memory-graph/config.yaml", "decay_half_life_days: 90\n");
    expect(fromState(collect(sandbox.root)).inject.decay).toBe("90 days");
    sandbox.write(".memory-graph/config.yaml", "decay_half_life_days: 7\n");
    expect(fromState(collect(sandbox.root)).inject.decay).toBe("7 days");
  });
});

describe("injectedCount (scenario 18)", () => {
  let sandbox: Sandbox;
  beforeEach(() => { sandbox = makeSandbox(); });
  afterEach(() => { sandbox.cleanup(); });

  it("equals the number of ids the last brief injected", () => {
    sandbox.write(
      "memory/nodes.json",
      JSON.stringify({
        nodes: [
          { id: "n1", claim: "c1", kind: "Decision", status: "confirmed", weight: 0.5, base_weight: 0.5, last_seen: "x", source_session: "s" },
        ],
      })
    );
    sandbox.write(
      "memory/.brief-injected.json",
      JSON.stringify({ updated: "2026-08-07T09:00:00Z", ids: ["n1", "ghost"] })
    );

    const data = fromState(collect(sandbox.root));
    expect(data.inject.injectedCount).toBe(2);
  });
});

describe("SAMPLE data (scenario 19)", () => {
  it("gives every SAMPLE node a unique string id and includes SAMPLE.inject", () => {
    const ids = SAMPLE.nodes.map((n) => n.id);
    ids.forEach((id) => expect(typeof id).toBe("string"));
    expect(new Set(ids).size).toBe(SAMPLE.nodes.length);
    expect(SAMPLE.inject).toBeDefined();
  });
});
