import type { z } from "zod";
import type {
  backendUserSchema,
  executionOptionsSchema,
  intelligenceLevelSchema,
  aiProviderSchema,
  runListResponseSchema,
  runStatusSchema,
  workflowRunSchema,
} from "@/lib/api/schemas";

export type BackendUser = z.infer<typeof backendUserSchema>;
export type AIProvider = z.infer<typeof aiProviderSchema>;
export type IntelligenceLevel = z.infer<typeof intelligenceLevelSchema>;
export type ExecutionOptions = z.infer<typeof executionOptionsSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
export type RunListResponse = z.infer<typeof runListResponseSchema>;
