import { z } from "zod";

export const bugTriageInputSchema = z.object({
  title: z.string().trim().min(3, "Give the issue a short, specific title."),
  affectedArea: z.string().trim().min(2, "Name the affected product area."),
  observedBehavior: z
    .string()
    .trim()
    .min(12, "Describe what happened with a little more detail."),
  expectedBehavior: z
    .string()
    .trim()
    .min(12, "Describe what should have happened."),
  evidence: z
    .array(
      z.object({
        value: z.string().trim().min(3, "Add a useful evidence point or remove this row."),
      }),
    )
    .min(1, "Add at least one known evidence point."),
  settings: z.string().trim().optional(),
  constraints: z.string().trim().optional(),
});

export const bugTriageOutputSchema = z.object({
  summary: z.string().min(1),
  confirmedFacts: z.array(z.string().min(1)),
  evidenceGaps: z.array(z.string().min(1)),
  likelyCategory: z.string().min(1),
  recommendedChecks: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1),
  humanReviewNotice: z.string().min(1),
});

export type BugTriageInput = z.infer<typeof bugTriageInputSchema>;
export type BugTriageOutput = z.infer<typeof bugTriageOutputSchema>;

export const bugTriageSampleInput: BugTriageInput = {
  title: "CSV export stalls on larger reports",
  affectedArea: "Analytics exports",
  observedBehavior:
    "Exports above roughly 10,000 rows remain in a processing state and never download.",
  expectedBehavior:
    "The export should finish and provide a downloadable CSV within the normal processing window.",
  evidence: [
    { value: "Reproduced in Chrome and Edge with the same workspace." },
    { value: "A 2,000-row report exports successfully." },
    { value: "The network panel shows the export status request returning 200." },
  ],
  settings: "Date range: last 12 months; all columns selected",
  constraints: "Do not test against production customer workspaces.",
};

export const bugTriageSampleOutput: BugTriageOutput = {
  summary:
    "Large CSV exports in Analytics remain in processing while smaller exports complete normally.",
  confirmedFacts: [
    "The issue affects Analytics exports above roughly 10,000 rows.",
    "The behavior was reproduced in both Chrome and Edge.",
    "A smaller 2,000-row export completes successfully.",
  ],
  evidenceGaps: [
    "No server-side export job duration or failure log was provided.",
    "The exact row-count threshold has not been isolated.",
  ],
  likelyCategory: "Scale-dependent export processing",
  recommendedChecks: [
    "Compare background job logs for a successful small export and a stalled large export.",
    "Test row counts around the observed threshold in a non-production workspace.",
    "Confirm whether result generation completes but file delivery fails.",
  ],
  confidence: 0.82,
  humanReviewNotice:
    "This triage is advisory. An engineer should validate the evidence and diagnosis before making a production change.",
};
