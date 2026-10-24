import { collect } from "@/lib/scan";
import { repoRoot } from "@/lib/repo-root";
import { fromState } from "@/lib/v2/from-state";
import { LiveDashboard } from "@/components/v2/LiveDashboard";

// The v2 dashboard reads the engine's real store — sessions, nodes and
// compression log — and renders it through the same `DashboardData` shape the
// design was drawn with. Rendered per request, never prerendered: the store
// changes on every agent stop, and again after every review action.
export const dynamic = "force-dynamic";

export default function Page(): React.JSX.Element {
  const state = collect(repoRoot());
  return <LiveDashboard data={fromState(state)} />;
}
