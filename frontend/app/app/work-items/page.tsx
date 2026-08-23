import type { Metadata } from "next";
import { WorkItemsPanel } from "@/features/work-items/work-items-panel";

export const metadata: Metadata = { title: "Work items", description: "Review and track work created from OpsPilot workflows." };

export default async function WorkItemsPage({ searchParams }: { searchParams: Promise<{ handoff?: string; case?: string }> }) {
  const query = await searchParams;
  return (
    <div className="mx-auto max-w-[96rem]">
      <div className="mb-7"><p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Operations</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground">Work items</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-muted">Turn reviewed triage into bounded delivery work, then keep its state visible for status reporting.</p></div>
      <WorkItemsPanel handoffId={query.handoff ?? null} caseId={query.case ?? null} />
    </div>
  );
}
