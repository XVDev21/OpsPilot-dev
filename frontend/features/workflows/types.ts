import type { ZodTypeAny } from "zod";

export const workflowIds = [
  "bug-triage",
  "meeting-actions",
  "status-update",
] as const;

export type WorkflowId = (typeof workflowIds)[number];
export type WorkflowCategory = "Technical" | "Collaboration" | "Operations";
export type WorkflowIconName = "bug" | "meeting" | "status";

export interface WorkflowDefinition {
  id: WorkflowId;
  title: string;
  shortTitle: string;
  category: WorkflowCategory;
  description: string;
  benefit: string;
  problem: string;
  ctaLabel: string;
  icon: WorkflowIconName;
  tone: "indigo" | "cyan" | "amber";
  inputSchema: ZodTypeAny;
  outputSchema: ZodTypeAny;
  sampleInput: unknown;
  sampleOutput: unknown;
  inputPreview: readonly string[];
  resultPreview: readonly string[];
}
