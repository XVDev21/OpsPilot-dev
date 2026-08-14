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
export const aiProviderSchema = z.enum(["gemini", "openai"]);
export const intelligenceLevelSchema = z.enum(["fast", "balanced", "high"]);

export const runOptionsSchema = z.object({
  provider: aiProviderSchema,
  intelligence: intelligenceLevelSchema,
});

export const createRunRequestSchema = z.object({
  input: z.unknown(),
  options: runOptionsSchema,
});

export const executionOptionsSchema = z.object({
  providers: z.array(z.object({ id: aiProviderSchema, label: z.string(), enabled: z.boolean() })),
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

export const workflowRunSchema = z.object({
  id: z.string().min(1),
  workflow_id: z.enum(workflowIds),
  status: runStatusSchema,
  input_json: jsonValueSchema,
  result_json: jsonValueSchema.nullable(),
  error_code: z.string().nullable(),
  provider: z.string().nullable(),
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
