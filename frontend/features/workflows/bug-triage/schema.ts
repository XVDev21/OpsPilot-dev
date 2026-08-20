import { z } from "zod";
import {
  collaboratorIdSchema,
  optionalCollaboratorIdSchema,
  workflowInputModeSchema,
} from "@/features/workflows/shared-schema";

export const bugTriageInputSchema = z.object({
  inputMode: workflowInputModeSchema,
  title: z.string().trim().min(3, "Give the issue a short, specific title.").max(200),
  affectedArea: z.string().trim().max(160).optional(),
  observedBehavior: z
    .string()
    .trim()
    .min(12, "Describe what happened with a little more detail.")
    .max(3000, "Keep the observed behavior under 3,000 characters."),
  expectedBehavior: z
    .string()
    .trim()
    .max(3000, "Keep the expected behavior under 3,000 characters.")
    .optional(),
  evidence: z
    .array(
      z.object({
        value: z.string().trim().min(3, "Add a useful evidence point or remove this row.").max(1000),
      }),
    )
    .max(12, "Keep evidence to the 12 most useful points."),
  settings: z.string().trim().max(2000).optional(),
  constraints: z.string().trim().max(2000).optional(),
  triageOwnerId: optionalCollaboratorIdSchema,
});

export const bugTriageOutputSchema = z.object({
  summary: z.string().min(1),
  confirmedFacts: z.array(z.string().min(1)),
  evidenceGaps: z.array(z.string().min(1)),
  likelyCategory: z.string().min(1),
  issueType: z.enum(["product-defect", "configuration-or-process", "needs-more-evidence"]),
  routing: z.object({
    team: z.enum(["operations", "support", "engineering"]),
    ownerId: collaboratorIdSchema.nullable(),
    rationale: z.string().min(1),
  }),
  recommendedChecks: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0).max(1),
  humanReviewNotice: z.string().min(1),
});

export type BugTriageInput = z.infer<typeof bugTriageInputSchema>;
export type BugTriageOutput = z.infer<typeof bugTriageOutputSchema>;

export const bugTriageSampleInput: BugTriageInput = {
  inputMode: "advanced",
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
  triageOwnerId: "sample-theo-bennett",
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
  issueType: "product-defect",
  routing: {
    team: "engineering",
    ownerId: "sample-theo-bennett",
    rationale: "The issue reproduces across browsers and changes with export size, so technical validation is warranted.",
  },
  recommendedChecks: [
    "Compare background job logs for a successful small export and a stalled large export.",
    "Test row counts around the observed threshold in a non-production workspace.",
    "Confirm whether result generation completes but file delivery fails.",
  ],
  confidence: 0.82,
  humanReviewNotice:
    "This triage is advisory. An engineer should validate the evidence and diagnosis before making a production change.",
};
