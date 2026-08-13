import type { z } from "zod";
import type {
  backendUserSchema,
  runListResponseSchema,
  runStatusSchema,
  workflowRunSchema,
} from "@/lib/api/schemas";

export type BackendUser = z.infer<typeof backendUserSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
export type RunListResponse = z.infer<typeof runListResponseSchema>;
