import { collect } from "@/lib/scan";
import { repoRoot } from "@/lib/repo-root";
import { DashboardView } from "@/components/DashboardView";

export default async function Page(): Promise<React.JSX.Element> {
  const state = collect(repoRoot());
  return <DashboardView initial={state} />;
}
