import { z } from "zod";
import {
  collaboratorIdSchema,
  optionalCollaboratorIdSchema,
  workflowInputModeSchema,
} from "@/features/workflows/shared-schema";

export const meetingActionsInputSchema = z.object({
  inputMode: workflowInputModeSchema,
  title: z.string().trim().min(3, "Give the meeting a clear title.").max(200),
  notes: z
    .string()
    .trim()
    .min(20, "Add enough notes to identify decisions and follow-up work.")
    .max(12000, "Keep meeting notes under 12,000 characters."),
  participants: z
    .array(z.object({ value: z.string().trim().min(2, "Enter a name or remove this row.").max(160) }))
    .max(50),
  date: z.string().trim().max(50).optional(),
  coordinatorId: optionalCollaboratorIdSchema,
});

export const meetingActionsOutputSchema = z.object({
  summary: z.string().min(1),
  followUpCoordinatorId: collaboratorIdSchema.nullable(),
  decisions: z.array(z.string().min(1)),
  actionItems: z.array(
    z.object({
      task: z.string().min(1),
      owner: z.string().nullable(),
      deadline: z.string().nullable(),
    }),
  ),
  openQuestions: z.array(z.string().min(1)),
  unresolvedItems: z.array(z.string().min(1)),
});

export type MeetingActionsInput = z.infer<typeof meetingActionsInputSchema>;
export type MeetingActionsOutput = z.infer<typeof meetingActionsOutputSchema>;

export const meetingActionsSampleInput: MeetingActionsInput = {
  inputMode: "advanced",
  title: "Release readiness sync",
  notes:
    "Decision: Keep the onboarding checklist inside the release workspace.\nAction: Maya will publish the revised checklist by Friday.\nAction: Sam will confirm support coverage.\nOpen question: Should contractors use the same checklist?",
  participants: [{ value: "Maya" }, { value: "Sam" }, { value: "Jordan" }],
  date: "2026-08-12",
  coordinatorId: "sample-amelia-cruz",
};

export const meetingActionsSampleOutput: MeetingActionsOutput = {
  summary:
    "The team aligned on where the onboarding checklist will live and assigned two release-readiness follow-ups.",
  followUpCoordinatorId: "sample-amelia-cruz",
  decisions: ["Keep the onboarding checklist inside the release workspace."],
  actionItems: [
    { task: "Publish the revised checklist.", owner: "Maya", deadline: "Friday" },
    { task: "Confirm support coverage.", owner: "Sam", deadline: null },
  ],
  openQuestions: ["Should contractors use the same checklist?"],
  unresolvedItems: ["No owner or due date was recorded for the contractor-checklist decision."],
};
