import { z } from "zod";
import { workflowIds } from "@/features/workflows/types";
import { ApiError } from "@/lib/api/errors";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

export const backendUserSchema = z.object({
  id: z.string().min(1),
  workos_user_id: z.string().min(1),
  email: z.string().email().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
});

export const runStatusSchema = z.enum(["pending", "completed", "failed"]);
export const runExecutionPhaseSchema = z.enum(["queued", "preparing", "generating", "validating", "saving", "completed", "failed"]);
export const aiProviderSchema = z.enum(["gemini", "openai", "qwen", "bedrock", "custom", "local"]);
export const intelligenceLevelSchema = z.enum(["fast", "balanced", "high"]);
export const credentialSourceSchema = z.enum(["personal", "platform", "connector"]);
export const qwenEndpointRegionSchema = z.enum(["singapore", "us", "beijing"]);
export const awsRegionSchema = z.enum(["us-east-1", "us-east-2", "us-west-2", "ap-northeast-1", "ap-south-1", "ap-southeast-1", "ap-southeast-2", "eu-central-1", "eu-west-1", "eu-west-2"]);
export const modelIdSchema = z.string().trim().min(2).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{1,255}$/);

export const runOptionsSchema = z.object({
  provider: aiProviderSchema,
  intelligence: intelligenceLevelSchema,
});

export const createRunRequestSchema = z.object({
  input: z.unknown(),
  options: runOptionsSchema,
  handoffId: z.string().uuid().nullable().optional(),
});

export const executionOptionsSchema = z.object({
  providers: z.array(z.object({
    id: aiProviderSchema,
    label: z.string(),
    description: z.string(),
    enabled: z.boolean(),
    credentialSource: credentialSourceSchema.nullable(),
    supportsPersonalKey: z.boolean(),
  })),
  intelligenceLevels: z.array(z.object({
    id: intelligenceLevelSchema,
    label: z.string(),
    description: z.string(),
    relativeUsage: z.enum(["lowest", "medium", "highest"]),
  })),
  defaultProvider: aiProviderSchema,
  defaultIntelligence: intelligenceLevelSchema,
  retentionDays: z.number().int().positive(),
});

export const providerCredentialInputSchema = z.object({
  apiKey: z.string().trim().min(16).max(2_048),
  endpointRegion: qwenEndpointRegionSchema.nullable().optional(),
  workspaceId: z.string().trim().min(2).max(63)
    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])$/)
    .nullable().optional(),
  displayName: z.string().trim().max(80).nullable().optional(),
  baseUrl: z.string().trim().url().max(500).nullable().optional(),
  awsRegion: awsRegionSchema.nullable().optional(),
  modelFast: modelIdSchema.nullable().optional(),
  modelBalanced: modelIdSchema.nullable().optional(),
  modelHigh: modelIdSchema.nullable().optional(),
});

export const providerCredentialSummarySchema = z.object({
  provider: aiProviderSchema,
  configured: z.boolean(),
  keyFingerprint: z.string().nullable(),
  endpointRegion: qwenEndpointRegionSchema.nullable(),
  workspaceId: z.string().nullable(),
  displayName: z.string().nullable(),
  baseUrl: z.string().nullable(),
  awsRegion: z.string().nullable(),
  modelFast: z.string().nullable(),
  modelBalanced: z.string().nullable(),
  modelHigh: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const providerCredentialListSchema = z.object({
  items: z.array(providerCredentialSummarySchema),
});

export const workflowRunSchema = z.object({
  id: z.string().min(1),
  workflow_id: z.enum(workflowIds),
  status: runStatusSchema,
  execution_phase: runExecutionPhaseSchema,
  input_json: jsonValueSchema,
  result_json: jsonValueSchema.nullable(),
  error_code: z.string().nullable(),
  provider: z.string().nullable(),
  credential_source: credentialSourceSchema.nullable(),
  model: z.string().nullable(),
  intelligence: intelligenceLevelSchema.nullable(),
  prompt_version: z.string().nullable(),
  input_tokens: z.number().int().nonnegative().nullable(),
  output_tokens: z.number().int().nonnegative().nullable(),
  duration_ms: z.number().nonnegative().nullable(),
  created_at: z.string().min(1),
  completed_at: z.string().nullable(),
  expires_at: z.string().nullable(),
});

export const runListResponseSchema = z.object({
  items: z.array(workflowRunSchema),
  next_cursor: z.string().nullable().optional(),
});

export const backendRunListSchema = z.union([runListResponseSchema, z.array(workflowRunSchema)]);

export const localConnectorSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  paired: z.boolean(),
  online: z.boolean(),
  modelFast: z.string(),
  modelBalanced: z.string(),
  modelHigh: z.string(),
  pairedAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  updatedAt: z.string(),
});

export const localConnectorEnvelopeSchema = z.object({ connector: localConnectorSummarySchema.nullable() });
export const localConnectorPairingSchema = z.object({
  connector: localConnectorSummarySchema,
  pairingCode: z.string(),
  expiresAt: z.string(),
});
export const localConnectorPairingInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  modelFast: modelIdSchema,
  modelBalanced: modelIdSchema,
  modelHigh: modelIdSchema,
});

export const workflowHandoffSchema = z.object({
  id: z.string().uuid(),
  sourceRunId: z.string().uuid(),
  target: z.enum(["work-item", "meeting-actions", "status-update"]),
  status: z.enum(["draft", "converted"]),
  draftInput: z.record(jsonValueSchema),
  targetRunId: z.string().uuid().nullable(),
  createdAt: z.string(),
  convertedAt: z.string().nullable(),
});
export const createHandoffInputSchema = z.object({ target: z.enum(["work-item", "meeting-actions", "status-update"]) });

export const workItemStatusSchema = z.enum(["todo", "in-progress", "blocked", "done"]);
export const workItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  kind: z.enum(["engineering", "verification", "investigation", "follow-up"]),
  status: workItemStatusSchema,
  assignee_id: z.string(),
  due_date: z.string().nullable(),
  source_run_id: z.string().uuid().nullable(),
  source_handoff_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const workItemListSchema = z.object({ items: z.array(workItemSchema) });
export const createWorkItemInputSchema = z.object({
  handoffId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(12).max(6000),
  kind: z.enum(["engineering", "verification", "investigation", "follow-up"]),
  assigneeId: z.string().trim().max(64),
  dueDate: z.string().date().nullable().optional(),
});
export const updateWorkItemInputSchema = z.object({ status: workItemStatusSchema });

export function parseApiResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(
      {
        code: "INVALID_API_RESPONSE",
        message: "The live API returned data that did not match the OpsPilot contract.",
        retryable: true,
      },
      502,
    );
  }
  return result.data;
}
