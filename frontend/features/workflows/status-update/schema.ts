import { z } from "zod";
import {
  collaboratorIdSchema,
  optionalCollaboratorIdSchema,
  workflowInputModeSchema,
} from "@/features/workflows/shared-schema";

export const statusAudienceValues = ["team", "manager", "stakeholders"] as const;
export const statusFormatValues = ["daily", "manager", "technical"] as const;

export const statusUpdateInputSchema = z.object({
  inputMode: workflowInputModeSchema,
  notes: z
    .string()
    .trim()
    .min(20, "Add a few concrete work notes before generating the update.")
    .max(12000, "Keep work notes under 12,000 characters."),
  audience: z.enum(statusAudienceValues),
  format: z.enum(statusFormatValues),
  authorId: optionalCollaboratorIdSchema,
});

export const statusUpdateOutputSchema = z.object({
  authorId: collaboratorIdSchema.nullable(),
  completed: z.array(z.string().min(1)),
  inProgress: z.array(z.string().min(1)),
  blocked: z.array(z.string().min(1)),
  nextSteps: z.array(z.string().min(1)),
  shareableUpdate: z.string().min(1),
});

export type StatusUpdateInput = z.infer<typeof statusUpdateInputSchema>;
export type StatusUpdateOutput = z.infer<typeof statusUpdateOutputSchema>;

export const statusUpdateSampleInput: StatusUpdateInput = {
  inputMode: "advanced",
  notes:
    "Completed: Shipped intake validation for all three workflows.\nIn progress: Polishing mobile result layouts.\nBlocked: Waiting for final WorkOS app credentials.\nNext: Run cross-browser checks and prepare the demo.",
  audience: "team",
  format: "daily",
  authorId: "sample-mina-park",
};

export const statusUpdateSampleOutput: StatusUpdateOutput = {
  authorId: "sample-mina-park",
  completed: ["Shipped intake validation for all three workflows."],
  inProgress: ["Polishing mobile result layouts."],
  blocked: ["Waiting for final WorkOS app credentials."],
  nextSteps: ["Run cross-browser checks and prepare the demo."],
  shareableUpdate:
    "Shipped intake validation across all three workflows. I’m now polishing the mobile result layouts. I’m waiting on the final WorkOS app credentials, and next I’ll run cross-browser checks and prepare the demo.",
};
