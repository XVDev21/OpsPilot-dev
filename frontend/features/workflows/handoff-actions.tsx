"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, CalendarCheck2, FileOutput, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { BugTriageOutput } from "@/features/workflows/bug-triage/schema";
import { browserApi } from "@/lib/api/browser-client";

const workItemLabels: Record<BugTriageOutput["issueType"], string> = {
  "product-defect": "Create engineering work item",
  "configuration-or-process": "Create verification follow-up",
  "needs-more-evidence": "Create investigation checklist",
};

export function HandoffActions({ sourceRunId, issueType }: { sourceRunId: string; issueType: BugTriageOutput["issueType"] }) {
  const router = useRouter();
  const handoff = useMutation({
    mutationFn: (target: "work-item" | "meeting-actions" | "status-update") => browserApi.createHandoff(sourceRunId, target),
    onSuccess: (draft) => {
      const handoffQuery = `?handoff=${encodeURIComponent(draft.id)}` as const;
      if (draft.target === "work-item") {
        router.push(`/app/work-items${handoffQuery}`);
      } else if (draft.target === "meeting-actions") {
        router.push(`/app/workflows/meeting-actions${handoffQuery}`);
      } else {
        router.push(`/app/workflows/status-update${handoffQuery}`);
      }
    },
  });
  return (
    <section className="mt-5 rounded-2xl border border-primary/20 bg-surface-accent p-4 sm:p-5" aria-labelledby="handoff-actions-heading">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><ArrowRight aria-hidden="true" className="size-4.5" /></span>
        <div>
          <h3 id="handoff-actions-heading" className="text-sm font-bold text-foreground">Move this triage into delivery</h3>
          <p className="mt-1 text-xs leading-5 text-foreground-muted">Every action opens an editable draft. OpsPilot will not assign or publish AI-suggested work without your confirmation.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button type="button" size="sm" className="min-h-11 justify-start" onClick={() => handoff.mutate("work-item")} disabled={handoff.isPending}>
          {handoff.isPending && handoff.variables === "work-item" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <BriefcaseBusiness aria-hidden="true" className="size-4" />}
          {workItemLabels[issueType]}
        </Button>
        <Button type="button" size="sm" variant="secondary" className="min-h-11 justify-start" onClick={() => handoff.mutate("meeting-actions")} disabled={handoff.isPending}>
          <CalendarCheck2 aria-hidden="true" className="size-4" /> Send to Meeting Actions
        </Button>
        <Button type="button" size="sm" variant="secondary" className="min-h-11 justify-start" onClick={() => handoff.mutate("status-update")} disabled={handoff.isPending}>
          <FileOutput aria-hidden="true" className="size-4" /> Add to Work Status
        </Button>
      </div>
      {handoff.isError ? <p className="mt-3 text-xs text-danger" role="alert">The workflow draft could not be created. The original triage result is unchanged.</p> : null}
    </section>
  );
}
