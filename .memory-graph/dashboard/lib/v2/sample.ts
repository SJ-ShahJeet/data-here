// Sample data the v2 design was drawn with. Every number and string here is
// illustrative; the tour's last step says as much. Swap this module for a real
// provider that returns the same `DashboardData` shape.
import type {
  CommandSection,
  DashboardData,
  GraphNodeRow,
  NodeKind,
  Proposal,
  QueueItem,
  Repo,
  ScanLine,
  Session,
  StackItem,
} from "./types";
import { KINDS, TOUR } from "./constants";

// ACCENT, KIND_COLOR, KINDS and TOUR live in ./constants; re-exported here so
// `components/v2/*` (which import them from this module) keep working.
export { ACCENT, KIND_COLOR, KINDS, TOUR } from "./constants";

const SCAN: ScanLine[] = [
  { text: "$ memgraph init --scan", tone: "cmd" },
  { text: "reading please/setup at HEAD (a41f0c2)", tone: "dim" },
  { text: "· package.json            pnpm workspace, 4 packages", tone: "" },
  { text: "· tsconfig.base.json      strict, paths aliased", tone: "" },
  { text: "· Dockerfile              multi-stage, node:20-alpine", tone: "" },
  { text: "· infra/main.tf           terraform 1.7, s3 backend", tone: "" },
  { text: "· infra/backend.tf        state locking via dynamodb", tone: "hit" },
  { text: "· .github/workflows/      3 workflows, 11 jobs", tone: "" },
  { text: "· CODEOWNERS              4 teams", tone: "" },
  { text: "walking 2,184 commits (90d window)", tone: "dim" },
  { text: "· 61 commits touch infra/ — 2 authors", tone: "" },
  { text: '· "revert" appears 9× on deploy paths', tone: "hit" },
  { text: "· migrations always paired with a seed script", tone: "hit" },
  { text: "reading 38 pull request descriptions", tone: "dim" },
  { text: "· review policy: 1 approval, 2 for infra/", tone: "hit" },
  { text: "12 proposals ready · 6 technologies detected", tone: "ok" },
  { text: "scan complete in 4.1s", tone: "ok" },
];

const STACK: StackItem[] = [
  { name: "TypeScript", evidence: "tsconfig.base.json · 214 files" },
  { name: "pnpm workspaces", evidence: "pnpm-workspace.yaml · 4 packages" },
  { name: "Terraform", evidence: "infra/*.tf · 1.7, s3 backend" },
  { name: "Docker", evidence: "Dockerfile · node:20-alpine" },
  { name: "GitHub Actions", evidence: ".github/workflows · 3 files" },
  { name: "AWS", evidence: 'provider "aws" · us-east-1, eu-west-2' },
];

const PROPOSALS: Proposal[] = [
  { claim: "Terraform state is locked through DynamoDB — concurrent applies fail loudly.", evidence: "infra/backend.tf:12", kind: "Constraint" },
  { claim: "Applies run from CI only; local credentials are denied by the bucket policy.", evidence: "infra/backend.tf:24 · 9 reverted deploy commits", kind: "Constraint" },
  { claim: "Every migration ships with a seed script in the same commit.", evidence: "inferred from 31 commits touching db/migrations", kind: "Decision" },
  { claim: "Infra changes need two approvals; everything else needs one.", evidence: "38 pull requests · CODEOWNERS", kind: "Decision" },
  { claim: "Packages are versioned together — no independent releases.", evidence: "pnpm-workspace.yaml · release.yml", kind: "Decision" },
  { claim: "The e2e job needs a seeded Postgres; it will not run against a blank DB.", evidence: ".github/workflows/test.yml:41", kind: "Test/CI fact" },
  { claim: "CI caches pnpm by lockfile hash; changing the lockfile costs a cold run.", evidence: ".github/workflows/ci.yml:18", kind: "Test/CI fact" },
  { claim: "node:20-alpine is pinned — 22 breaks the native bcrypt build.", evidence: "Dockerfile:1 · reverted in a41f0c2", kind: "Dependency" },
  { claim: "eu-west-2 exists in the provider config but has no resources yet.", evidence: "infra/providers.tf:9", kind: "Open thread" },
  { claim: "Two teams own infra/ and neither is listed as reviewer on recent PRs.", evidence: "CODEOWNERS · last 20 PRs", kind: "Open thread" },
  { claim: "Secrets come from SSM Parameter Store, never from .env in deployed envs.", evidence: "infra/ssm.tf · 4 workflow references", kind: "Constraint" },
  { claim: "The staging workspace shares a VPC with production.", evidence: "infra/network/vpc.tf:33", kind: "Constraint" },
];

const section = (title: string, note: string, rows: [string, string, string][]): CommandSection => ({
  title, note, items: rows.map(([cmd, desc, flags]) => ({ cmd, desc, flags })),
});

const COMMANDS: CommandSection[] = [
  section("Install", "pick one", [
    ["npm i -g @memgraph/cli", "Global install, needs Node 20+.", "--version to verify"],
    ["brew install memgraph", "Homebrew tap, macOS and Linuxbrew.", "brew upgrade memgraph"],
    ["curl -fsSL get.memgraph.dev | sh", "Standalone binary into ~/.local/bin.", "MG_INSTALL_DIR=… to relocate"],
    ['docker run --rm -v "$PWD:/repo" memgraph/cli', "No local install; mount the repo at /repo.", "-e MG_TOKEN"],
    ["go install github.com/memgraph/cli@latest", "Build from source with Go 1.22+.", "@v0.9.3 to pin"],
    ["cargo install memgraph-cli", "Rust toolchain build.", "--locked"],
  ]),
  section("Init & scan", "run once per repository", [
    ["memgraph init", "Create .memgraph/ and register the repo with the daemon.", "--no-scan  --remote <url>"],
    ["memgraph init --scan", "Init, then read the repo and propose nodes.", "--depth <commits>  --since <date>"],
    ["memgraph scan", "Re-read the repo and refresh proposals.", "--only code|history|prs  --dry-run"],
  ]),
  section("Inspect", "read the graph", [
    ["memgraph status", "Node count, coverage, unreviewed backlog.", "--json"],
    ["memgraph ls", "List nodes, highest weight first.", "--kind constraint  --min-weight 0.4  --limit 50"],
    ["memgraph show <id>", "One node: claim, edges, history, sessions that used it.", "--edges  --history"],
    ["memgraph why <id>", "Where the node came from and what keeps it alive.", "--verbose"],
  ]),
  section("Write", "add or change nodes", [
    ['memgraph add "<claim>"', "Write a node by hand; pre-confirmed.", "--kind decision  --path <file>  --pin"],
    ["memgraph edit <id>", "Open the claim in $EDITOR.", "--set-kind  --set-weight"],
    ["memgraph link <a> <b>", "Draw an edge between two nodes.", "--type supersedes|depends-on|contradicts"],
  ]),
  section("Review", "confirm what a run wrote", [
    ["memgraph review", "Walk the unreviewed queue interactively.", "--batch  --kind <type>"],
    ["memgraph confirm <id>", "Mark true and lock the weight.", "--all  --since 7d"],
    ["memgraph reject <id>", "Drop it from injection permanently.", "--all --kind open-thread"],
  ]),
  section("Prune & decay", "keep the graph honest", [
    ["memgraph prune", "Remove nodes below the weight floor.", "--min-weight 0.1  --dry-run  --older-than 60d"],
    ["memgraph decay --half-life 30d", "Set how fast unused nodes lose weight.", "--off  --half-life <duration>"],
    ["memgraph merge <a> <b>", "Fold two nodes into one, keeping both histories.", "--keep a|b|newest"],
  ]),
  section("Injection", "what the model receives", [
    ["memgraph config get inject", "Print the current injection rules.", "--json"],
    ["memgraph config set inject.budget 6k", "Cap the context handed to each session.", "inject.min_weight  inject.kinds"],
    ["memgraph preview", "Print exactly what the next session would receive.", "--budget 12k  --diff"],
  ]),
  section("CI", "keep memory current without a human", [
    ["memgraph ci scan", "Scan on merge and open proposals as a PR comment.", "--fail-on-conflict"],
    ["memgraph ci check", "Fail the build when a change contradicts a confirmed node.", "--kind constraint  --strict"],
    ["memgraph serve --daemon", "Run the daemon for shared/team indexes.", "--port 7373  --index remote"],
  ]),
  section("Move data", "portable graphs", [
    ["memgraph export graph.json", "Full graph with edges, weights, history.", "--kind <type>  --confirmed-only"],
    ["memgraph import graph.json", "Merge another graph into this one.", "--strategy merge|replace  --dry-run"],
  ]),
  section("Remove", "clean exit", [
    ["memgraph disconnect", "Unregister the repo; the graph file stays.", "--purge to delete .memgraph/"],
    ["npm rm -g @memgraph/cli", "Remove the CLI. Homebrew: brew uninstall memgraph.", ""],
  ]),
];

const r = (kind: NodeKind, text: string) => ({ kind, text });

const SESSIONS: Session[] = [
  { id: "S-1841", when: "2h", title: "Fix NAT gateway cost regression in us-east-1", read: 14, wrote: 3,
    stamp: "today, 09:14 · 26 turns",
    summary: "Traced the cost spike to a second NAT gateway created by the blue/green module. Removed it, then hit the state-lock constraint mid-apply.",
    reads: [r("Constraint", "us-east-1 is the only region with NAT"), r("Decision", "Terraform state locks via DynamoDB"), r("Dependency", "eks module pinned to 19.x"), r("Test/CI fact", "Integration suite needs LocalStack")],
    decided: ["Blue/green module should reuse the existing NAT, not create one.", "Cost alarms move to the platform account."],
    open: ["Does the same duplication exist in eu-west-2?"],
    injected: "4.2k", saved: "31.8k", duration: "18m" },
  { id: "S-1839", when: "6h", title: "Upgrade eks module to 20.x on staging", read: 11, wrote: 2,
    stamp: "today, 05:40 · 19 turns",
    summary: "Read the 20.x changelog against our module inputs. Node group renames would break the staging workspace, so the upgrade was deferred.",
    reads: [r("Dependency", "eks module pinned to 19.x"), r("Dependency", "kube-proxy pinned to 1.28 on staging"), r("Decision", "Helm charts vendored, not pulled")],
    decided: ["Hold at 19.x until the node group inputs are mapped."],
    open: ["Who owns the staging workspace lock?", "Is kube-proxy 1.28 still required after 20.x?"],
    injected: "3.6k", saved: "22.1k", duration: "12m" },
  { id: "S-1836", when: "1d", title: "Plan eu-west-2 expansion", read: 9, wrote: 4,
    stamp: "yesterday, 16:02 · 31 turns",
    summary: "Drafted the region rollout. Quota headroom turned out to be the blocker and the request was never filed.",
    reads: [r("Constraint", "us-east-1 is the only region with NAT"), r("Open thread", "Nightly plan drifts on IAM tags")],
    decided: ["eu-west-2 gets its own state bucket, not a prefix."],
    open: ["Quota raise for eu-west-2 is unconfirmed."],
    injected: "5.1k", saved: "38.4k", duration: "27m" },
  { id: "S-1834", when: "2d", title: "Silence nightly plan drift on IAM tags", read: 7, wrote: 1,
    stamp: "2 days ago, 22:11 · 8 turns",
    summary: "Added ignore_changes for the cost-center tag that the tagging lambda rewrites every night.",
    reads: [r("Open thread", "Nightly plan drifts on IAM tags"), r("Test/CI fact", "CI runners live in the same VPC")],
    decided: ["Tag drift is owned by the tagging lambda, not Terraform."],
    open: [],
    injected: "2.4k", saved: "14.7k", duration: "6m" },
  { id: "S-1830", when: "3d", title: "Audit bastion host access paths", read: 12, wrote: 2,
    stamp: "3 days ago, 11:26 · 22 turns",
    summary: "Found the legacy bastion runbook still referenced in two places. SSM Session Manager covers both paths now.",
    reads: [r("Decision", "Terraform state locks via DynamoDB"), r("Dependency", "Legacy VPC peering to analytics")],
    decided: ["Bastion hosts are deprecated; SSM only."],
    open: ["The analytics peering still allows SSH inbound."],
    injected: "3.9k", saved: "26.3k", duration: "21m" },
  { id: "S-1827", when: "4d", title: "Vendor Helm charts for the ingress stack", read: 6, wrote: 3,
    stamp: "4 days ago, 14:48 · 15 turns",
    summary: "Pulled ingress-nginx into the repo so CI stops reaching the public chart museum.",
    reads: [r("Decision", "Helm charts vendored, not pulled"), r("Test/CI fact", "Integration suite needs LocalStack")],
    decided: ["All charts are vendored under charts/ with a sync script."],
    open: [],
    injected: "2.8k", saved: "17.9k", duration: "11m" },
];

let nodeSeq = 0;
const node = (claim: string, path: string, kind: NodeKind, weight: number, seen: string, status: GraphNodeRow["status"]): GraphNodeRow =>
  ({ id: `s${++nodeSeq}`, claim, path, kind, weight, seen, status });

const NODES: GraphNodeRow[] = [
  node("us-east-1 is the only region with NAT", "infra/network/nat.tf", "Constraint", 0.92, "2h", "confirmed"),
  node("Terraform state locks via DynamoDB", "infra/backend.tf", "Decision", 0.86, "2h", "confirmed"),
  node("kube-proxy pinned to 1.28 on staging", "clusters/staging/versions.yaml", "Dependency", 0.71, "6h", "confirmed"),
  node("Applies must run from the ops VPN", "inferred · S-1841", "Constraint", 0.61, "2h", "unreviewed"),
  node("Nightly plan drifts on IAM tags", "infra/iam/tags.tf", "Open thread", 0.64, "2d", "confirmed"),
  node("eks module pinned to 19.x", "modules/eks/versions.tf", "Dependency", 0.48, "6h", "unreviewed"),
  node("eu-west-2 quota raise pending", "inferred · S-1836", "Open thread", 0.44, "1d", "unreviewed"),
  node("Integration suite needs LocalStack", ".github/workflows/test.yml", "Test/CI fact", 0.38, "4d", "confirmed"),
  node("Helm charts vendored, not pulled", "charts/README.md", "Decision", 0.24, "4d", "pinned"),
  node("Legacy VPC peering to analytics", "infra/network/peering.tf", "Dependency", 0.19, "31d", "stale"),
  node("Old bastion host runbook", "docs/runbooks/bastion.md", "Decision", 0.11, "58d", "stale"),
];

const QUEUE: QueueItem[] = [
  { id: "q1", kind: "Constraint", meta: "weight 0.61 · 2h ago", claim: "Terraform applies must run from the ops VPN — the state bucket denies public IPs.", source: "inferred from a failed apply in session S-1841" },
  { id: "q2", kind: "Dependency", meta: "weight 0.48 · 6h ago", claim: "The eks module is pinned to 19.x; 20.x renames the node group inputs.", source: "read from modules/eks/versions.tf during S-1839" },
  { id: "q3", kind: "Open thread", meta: "weight 0.44 · yesterday", claim: "Nobody has confirmed whether eu-west-2 got its quota raise.", source: "left unresolved at the end of S-1836" },
];

const repo = (name: string, stack: string, nodes: number, coverage: number, saved: string, unreviewed: number, self = false): Repo =>
  ({ name, stack, nodes, coverage, saved, unreviewed, self });

const REPOS: Repo[] = [
  repo("orbital/infra", "Terraform · K8s", 318, 0.74, "4.9M", 12, true),
  repo("orbital/gateway", "Go · gRPC", 264, 0.81, "3.7M", 6),
  repo("orbital/console", "TypeScript · React", 241, 0.62, "2.8M", 19),
  repo("orbital/ledger", "Rust", 197, 0.69, "2.2M", 4),
  repo("orbital/pipeline", "Python · Airflow", 152, 0.55, "1.6M", 14),
  repo("orbital/docs", "MDX", 96, 0.43, "0.9M", 8),
  repo("orbital/mobile", "Swift · Kotlin", 88, 0.31, "0.7M", 23),
];

export const SAMPLE: DashboardData = {
  repo: "orbital/infra",
  daemon: "daemon live · 4m",
  connection: "orbital/infra · local index · last scan 4m ago",
  sessionCount: 142,
  nodeCount: 318,
  metrics: [
    { label: "Sessions", value: "142", note: "+31 vs. previous", spark: [88, 96, 91, 104, 112, 118, 126, 142], accent: true },
    { label: "Nodes", value: "318", note: "47 written this window", spark: [262, 271, 279, 288, 296, 303, 311, 318] },
    { label: "Reviewed", value: "71%", note: "12 waiting on you", spark: [61, 64, 63, 66, 68, 69, 70, 71] },
    { label: "Context hit rate", value: "84%", note: "injected memory was used", spark: [72, 76, 74, 79, 81, 80, 83, 84] },
    { label: "Tokens saved", value: "4.9M", note: "this window", spark: [2.9, 3.2, 3.4, 3.8, 4.1, 4.4, 4.7, 4.9] },
  ],
  queue: QUEUE,
  weights: [
    { label: "us-east-1 is the only region with NAT", kind: "Constraint", now: 0.92, then: 0.74 },
    { label: "Terraform state locks via DynamoDB", kind: "Decision", now: 0.86, then: 0.81 },
    { label: "kube-proxy pinned to 1.28 on staging", kind: "Dependency", now: 0.71, then: 0.88 },
    { label: "Nightly plan drifts on IAM tags", kind: "Open thread", now: 0.64, then: 0.44 },
    { label: "Integration suite needs LocalStack", kind: "Test/CI fact", now: 0.38, then: 0.69 },
    { label: "Helm charts vendored, not pulled", kind: "Decision", now: 0.24, then: 0.52 },
  ],
  kinds: [
    { kind: "Decision", count: 108 },
    { kind: "Constraint", count: 73 },
    { kind: "Open thread", count: 57 },
    { kind: "Dependency", count: 48 },
    { kind: "Test/CI fact", count: 32 },
  ],
  sessions: SESSIONS,
  nodes: NODES,
  repos: REPOS,
  fleet: { repos: 9, saved: "18.4M", medianCoverage: "62%", unreviewed: 86 },
  commands: COMMANDS,
  scan: SCAN,
  scanDuration: "4.1s",
  stack: STACK,
  proposals: PROPOSALS,
  tour: TOUR,
  inject: { budget: "6k", kinds: [...KINDS], minWeight: 30, decay: "30 days", injectedCount: 7 },
};
