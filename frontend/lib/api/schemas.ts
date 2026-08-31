import { z } from "zod";
import { workflowIds } from "@/features/workflows/types";
import { ApiError } from "@/lib/api/errors";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

export const backendUserSchema = z.object({
  id: z.string().min(1),
  workos_user_id: z.string().min(1),
  email: z.string().email().nullable(),
  display_name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
});

export const runStatusSchema = z.enum(["pending", "completed", "failed"]);
export const runExecutionPhaseSchema = z.enum([
  "queued",
  "preparing",
  "generating",
  "validating",
  "saving",
  "completed",
  "failed",
]);
export const aiProviderSchema = z.enum([
  "gemini",
  "openai",
  "qwen",
  "bedrock",
  "custom",
  "local",
]);
export const intelligenceLevelSchema = z.enum(["fast", "balanced", "high"]);
export const credentialSourceSchema = z.enum([
  "personal",
  "platform",
  "connector",
]);
export const qwenEndpointRegionSchema = z.enum(["singapore", "us", "beijing"]);
export const awsRegionSchema = z.enum([
  "us-east-1",
  "us-east-2",
  "us-west-2",
  "ap-northeast-1",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
]);
export const modelIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{1,255}$/);

export const runOptionsSchema = z.object({
  provider: aiProviderSchema,
  intelligence: intelligenceLevelSchema,
});

export const createRunRequestSchema = z.object({
  input: z.unknown(),
  options: runOptionsSchema,
  handoffId: z.string().uuid().nullable().optional(),
  caseId: z.string().uuid().nullable().optional(),
});

export const executionOptionsSchema = z.object({
  providers: z.array(
    z.object({
      id: aiProviderSchema,
      label: z.string(),
      description: z.string(),
      enabled: z.boolean(),
      credentialSource: credentialSourceSchema.nullable(),
      supportsPersonalKey: z.boolean(),
      supportsImages: z.boolean(),
      models: z.object({
        fast: z.string().nullable(),
        balanced: z.string().nullable(),
        high: z.string().nullable(),
      }),
    }),
  ),
  intelligenceLevels: z.array(
    z.object({
      id: intelligenceLevelSchema,
      label: z.string(),
      description: z.string(),
      relativeUsage: z.enum(["lowest", "medium", "highest"]),
    }),
  ),
  defaultProvider: aiProviderSchema,
  defaultIntelligence: intelligenceLevelSchema,
  retentionDays: z.number().int().positive(),
});

export const providerCredentialInputSchema = z.object({
  apiKey: z.string().trim().min(16).max(2_048),
  endpointRegion: qwenEndpointRegionSchema.nullable().optional(),
  workspaceId: z
    .string()
    .trim()
    .min(2)
    .max(63)
    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])$/)
    .nullable()
    .optional(),
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
  case_id: z.string().uuid().nullable(),
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

export const backendRunListSchema = z.union([
  runListResponseSchema,
  z.array(workflowRunSchema),
]);

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

export const localConnectorEnvelopeSchema = z.object({
  connector: localConnectorSummarySchema.nullable(),
});
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
  caseId: z.string().uuid().nullable(),
  sourceRunId: z.string().uuid(),
  target: z.enum(["work-item", "meeting-actions", "status-update"]),
  status: z.enum(["draft", "converted"]),
  draftInput: z.record(jsonValueSchema),
  targetRunId: z.string().uuid().nullable(),
  createdAt: z.string(),
  convertedAt: z.string().nullable(),
});
export const createHandoffInputSchema = z.object({
  target: z.enum(["work-item", "meeting-actions", "status-update"]),
});

export const workItemStatusSchema = z.enum([
  "todo",
  "in-progress",
  "blocked",
  "done",
]);
export const workItemSchema = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string(),
  kind: z.enum(["engineering", "verification", "investigation", "follow-up"]),
  status: workItemStatusSchema,
  assigneeId: z.string().uuid().nullable(),
  assigneeKey: z.string().nullable(),
  assigneeName: z.string().nullable(),
  dueDate: z.string().nullable(),
  sourceRunId: z.string().uuid().nullable(),
  sourceHandoffId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const workItemListSchema = z.object({ items: z.array(workItemSchema) });
export const createWorkItemInputSchema = z.object({
  handoffId: z.string().uuid().nullable().optional(),
  caseId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(12).max(6000),
  kind: z.enum(["engineering", "verification", "investigation", "follow-up"]),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
});
export const updateWorkItemInputSchema = z
  .object({
    status: workItemStatusSchema.optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    dueDate: z.string().date().nullable().optional(),
    blockerReason: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one work-item change.",
  );

export const workspaceMemberSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  email: z.string().email().nullable(),
  initials: z.string(),
  role: z.string(),
  discipline: z.string(),
  focus: z.string(),
  availability: z.string(),
  workflowFit: z.array(z.string()),
  tone: z.enum(["indigo", "cyan", "amber", "neutral"]),
  isSample: z.boolean(),
  linkedAccount: z.boolean(),
  accessRole: z.enum(["owner", "operator", "contributor", "viewer"]),
});
export const workspaceRosterMemberSchema = workspaceMemberSchema.extend({
  membershipState: z.enum(["sample", "active", "inactive"]),
  isActive: z.boolean(),
  workosManaged: z.boolean(),
  joinedAt: z.string().nullable(),
  assignedCaseCount: z.number().int().nonnegative(),
  openTaskCount: z.number().int().nonnegative(),
});
export const workspaceMemberListSchema = z.object({
  items: z.array(workspaceRosterMemberSchema),
});
export const workspaceSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  workosOrganizationId: z.string().nullable(),
  collaborationState: z.enum(["personal", "provisioning", "active", "error"]),
  accessRole: z.enum(["owner", "operator", "contributor", "viewer"]),
  isCurrent: z.boolean(),
});
export const workspaceContextSchema = z.object({
  currentWorkspaceId: z.string().uuid(),
  items: z.array(workspaceSummarySchema),
});
export const workspaceInvitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  accessRole: z.enum(["owner", "operator", "contributor", "viewer"]),
  state: z.enum(["pending", "accepted", "expired", "revoked", "failed"]),
  targetMemberId: z.string().uuid().nullable(),
  targetMemberName: z.string().nullable(),
  expiresAt: z.string().nullable(),
  acceptedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});
export const workspaceInvitationListSchema = z.object({
  items: z.array(workspaceInvitationSchema),
});
export const workspaceReconciliationSchema = z.object({
  memberCount: z.number().int().nonnegative(),
  invitationCount: z.number().int().nonnegative(),
});

export const notificationEventPreferencesSchema = z.object({
  assignment: z.boolean().nullable(),
  blocker: z.boolean().nullable(),
  mention: z.boolean().nullable(),
  resolution: z.boolean().nullable(),
  verification: z.boolean().nullable(),
  dueDate: z.boolean().nullable(),
});
export const workspaceNotificationDefaultsSchema = z.object({
  emailEnabled: z.boolean(),
  assignment: z.boolean(),
  blocker: z.boolean(),
  mention: z.boolean(),
  resolution: z.boolean(),
  verification: z.boolean(),
  dueDate: z.boolean(),
});
export const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean(),
  eventOverrides: notificationEventPreferencesSchema,
  effectiveEvents: notificationEventPreferencesSchema,
  workspaceDefaults: workspaceNotificationDefaultsSchema,
  canManageWorkspaceDefaults: z.boolean(),
  providerConfigured: z.boolean(),
  sender: z.string(),
});
export const notificationSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum([
    "assignment",
    "blocker",
    "mention",
    "resolution",
    "verification",
    "due-date",
    "published",
  ]),
  title: z.string(),
  summary: z.string(),
  caseId: z.string().uuid(),
  caseKey: z.string(),
  caseTitle: z.string(),
  actionPath: z.string().startsWith("/app/cases/"),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export const notificationListSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
});
export const updateNotificationPreferencesInputSchema = z.object({
  emailEnabled: z.boolean().optional(),
  eventOverrides: notificationEventPreferencesSchema.optional(),
  workspaceDefaults: workspaceNotificationDefaultsSchema.optional(),
});

export const caseStatusSchema = z.enum([
  "new",
  "triaging",
  "needs-information",
  "action-required",
  "in-progress",
  "verification",
  "monitoring",
  "resolved",
  "closed",
]);
export const caseDispositionSchema = z.enum([
  "unclassified",
  "product-defect",
  "configuration-change",
  "process-guidance",
  "external-dependency",
  "duplicate",
  "needs-more-evidence",
]);
export const caseIntentSchema = z.enum([
  "issue",
  "clarification",
  "enhancement",
]);
export const casePublicationStateSchema = z.enum([
  "draft",
  "published",
  "archived",
]);
export const operationsCaseSummarySchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  title: z.string(),
  summary: z.string(),
  intent: caseIntentSchema,
  publicationState: casePublicationStateSchema,
  status: caseStatusSchema,
  disposition: caseDispositionSchema,
  confidence: z.number().min(0).max(1).nullable(),
  dueDate: z.string().nullable(),
  assignee: workspaceMemberSchema.nullable(),
  workItemCount: z.number().int().nonnegative(),
  completedWorkItemCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const operationsCaseListSchema = z.object({
  items: z.array(operationsCaseSummarySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export const caseEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  actorName: z.string(),
  payload: z.record(jsonValueSchema),
  createdAt: z.string(),
});
export const caseWorkItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  kind: z.enum(["engineering", "verification", "investigation", "follow-up"]),
  status: workItemStatusSchema,
  assignee: workspaceMemberSchema.nullable(),
  dueDate: z.string().nullable(),
  blockerReason: z.string(),
  completedAt: z.string().nullable(),
  sourceRunId: z.string().uuid().nullable(),
  sourceHandoffId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const caseEvidenceSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["text", "image"]),
  text: z.string(),
  caption: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  byteSize: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  downloadUrl: z.string().nullable(),
  createdAt: z.string(),
});
export const confidenceFactorSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(1),
  rationale: z.string(),
});
export const caseAssessmentSchema = z.object({
  id: z.string().uuid(),
  sequence: z.number().int().positive(),
  sourceRunId: z.string().uuid().nullable(),
  provider: z.string(),
  model: z.string(),
  intelligence: z.string(),
  promptVersion: z.string(),
  result: z.record(jsonValueSchema),
  proposedDisposition: caseDispositionSchema,
  modelConfidence: z.number().min(0).max(1),
  decisionConfidence: z.number().min(0).max(1),
  confidenceBand: z.enum(["low", "medium", "high"]),
  confidenceFactors: z.array(confidenceFactorSchema),
  isApplied: z.boolean(),
  appliedAt: z.string().nullable(),
  createdAt: z.string(),
});
export const caseUpdateAttachmentSchema = z.object({
  id: z.string().uuid(),
  originalFilename: z.string(),
  mimeType: z.string(),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  downloadUrl: z.string(),
});
export const caseUpdateSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    "progress",
    "blocker",
    "decision",
    "clarification",
    "resolution",
    "verification",
  ]),
  body: z.string(),
  author: workspaceMemberSchema.nullable(),
  taskId: z.string().uuid().nullable(),
  externalLinks: z.array(z.record(jsonValueSchema)),
  verificationResult: z.enum(["", "passed", "failed"]),
  mentionedMembers: z.array(workspaceMemberSchema),
  attachments: z.array(caseUpdateAttachmentSchema),
  createdAt: z.string(),
});
export const operationsCaseDetailSchema = operationsCaseSummarySchema.extend({
  description: z.string(),
  affectedArea: z.string(),
  expectedOutcome: z.string(),
  environmentContext: z.string(),
  settingsContext: z.string(),
  constraints: z.string(),
  publishedAt: z.string().nullable(),
  publishedAssessmentId: z.string().uuid().nullable(),
  resolutionSummary: z.string(),
  resolvedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  workflowRuns: z.array(
    z.object({
      id: z.string().uuid(),
      workflowId: z.enum(workflowIds),
      status: runStatusSchema,
      executionPhase: z.string(),
      createdAt: z.string(),
      completedAt: z.string().nullable(),
    }),
  ),
  evidence: z.array(caseEvidenceSchema),
  assessments: z.array(caseAssessmentSchema),
  workItems: z.array(caseWorkItemSchema),
  updates: z.array(caseUpdateSchema),
  events: z.array(caseEventSchema),
});
export const createCaseInputSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(12).max(6000),
  intent: caseIntentSchema.default("issue"),
  affectedArea: z.string().trim().max(160).optional(),
  expectedOutcome: z.string().trim().max(3000).optional(),
  environmentContext: z.string().trim().max(2000).optional(),
  settingsContext: z.string().trim().max(2000).optional(),
  constraints: z.string().trim().max(2000).optional(),
  evidenceNotes: z.array(z.string().trim().min(3).max(3000)).max(12).optional(),
  summary: z.string().trim().max(3000).optional(),
  disposition: caseDispositionSchema.optional(),
  dueDate: z.string().date().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});
export const updateCaseInputSchema = z
  .object({
    status: caseStatusSchema.optional(),
    disposition: caseDispositionSchema.optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
    dueDate: z.string().date().nullable().optional(),
    resolutionSummary: z.string().trim().max(4000).optional(),
    publicationState: z.enum(["draft", "archived"]).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one case change.",
  );
export const updateCaseAssignmentInputSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
});
export const publishCaseInputSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
  assessmentId: z.string().uuid().nullable().optional(),
  overrideAdvisory: z.boolean().optional(),
});
export const createCaseUpdateInputSchema = z.object({
  clientRequestId: z.string().uuid(),
  type: z.enum([
    "progress",
    "blocker",
    "decision",
    "clarification",
    "resolution",
    "verification",
  ]),
  body: z.string().trim().min(3).max(6000),
  taskId: z.string().uuid().nullable().optional(),
  externalLinks: z
    .array(
      z.object({
        label: z.string().trim().min(2).max(80),
        url: z.string().url().max(1000).refine((value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS URL."),
      }),
    )
    .max(8)
    .optional(),
  verificationResult: z.enum(["passed", "failed"]).optional(),
  mentionedMemberIds: z.array(z.string().uuid()).max(12).optional(),
});
export const createTextEvidenceInputSchema = z.object({
  text: z.string().trim().min(3).max(3000),
});
export const createAssessmentInputSchema = z.object({
  provider: aiProviderSchema,
  intelligence: intelligenceLevelSchema,
});

export function parseApiResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(
      {
        code: "INVALID_API_RESPONSE",
        message:
          "The live API returned data that did not match the OpsPilot contract.",
        retryable: true,
      },
      502,
    );
  }
  return result.data;
}
