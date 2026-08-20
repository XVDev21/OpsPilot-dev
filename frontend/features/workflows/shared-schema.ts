import { z } from "zod";

export const workflowInputModeValues = ["simple", "advanced"] as const;
export const workflowInputModeSchema = z.enum(workflowInputModeValues);

export const collaboratorIdSchema = z
  .string()
  .trim()
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]{2,63}$/, "Choose a valid collaborator.");

export const optionalCollaboratorIdSchema = z.union([
  collaboratorIdSchema,
  z.literal(""),
]).optional();

export type WorkflowInputMode = z.infer<typeof workflowInputModeSchema>;
