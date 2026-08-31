import type { z } from "zod";
import type {
  backendUserSchema,
  executionOptionsSchema,
  intelligenceLevelSchema,
  aiProviderSchema,
  providerCredentialInputSchema,
  providerCredentialListSchema,
  providerCredentialSummarySchema,
  qwenEndpointRegionSchema,
  awsRegionSchema,
  localConnectorEnvelopeSchema,
  localConnectorPairingSchema,
  workflowHandoffSchema,
  workItemListSchema,
  workItemSchema,
  workItemStatusSchema,
  runListResponseSchema,
  runStatusSchema,
  workflowRunSchema,
  workspaceMemberSchema,
  workspaceRosterMemberSchema,
  workspaceMemberListSchema,
  workspaceContextSchema,
  workspaceInvitationSchema,
  workspaceInvitationListSchema,
  notificationPreferencesSchema,
  notificationSchema,
  notificationListSchema,
  updateNotificationPreferencesInputSchema,
  caseStatusSchema,
  caseDispositionSchema,
  caseIntentSchema,
  casePublicationStateSchema,
  caseEvidenceSchema,
  caseAssessmentSchema,
  caseUpdateSchema,
  createCaseUpdateInputSchema,
  operationsCaseSummarySchema,
  operationsCaseListSchema,
  operationsCaseDetailSchema,
  createCaseInputSchema,
  updateCaseInputSchema,
  updateWorkItemInputSchema,
} from "@/lib/api/schemas";

export type BackendUser = z.infer<typeof backendUserSchema>;
export type AIProvider = z.infer<typeof aiProviderSchema>;
export type IntelligenceLevel = z.infer<typeof intelligenceLevelSchema>;
export type QwenEndpointRegion = z.infer<typeof qwenEndpointRegionSchema>;
export type AwsRegion = z.infer<typeof awsRegionSchema>;
export type ExecutionOptions = z.infer<typeof executionOptionsSchema>;
export type ProviderCredentialInput = z.infer<typeof providerCredentialInputSchema>;
export type ProviderCredentialSummary = z.infer<typeof providerCredentialSummarySchema>;
export type ProviderCredentialList = z.infer<typeof providerCredentialListSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
export type RunListResponse = z.infer<typeof runListResponseSchema>;
export type LocalConnectorEnvelope = z.infer<typeof localConnectorEnvelopeSchema>;
export type LocalConnectorPairing = z.infer<typeof localConnectorPairingSchema>;
export type WorkflowHandoff = z.infer<typeof workflowHandoffSchema>;
export type WorkItem = z.infer<typeof workItemSchema>;
export type WorkItemList = z.infer<typeof workItemListSchema>;
export type WorkItemStatus = z.infer<typeof workItemStatusSchema>;
export type WorkItemUpdate = z.infer<typeof updateWorkItemInputSchema>;
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;
export type WorkspaceRosterMember = z.infer<typeof workspaceRosterMemberSchema>;
export type WorkspaceMemberList = z.infer<typeof workspaceMemberListSchema>;
export type WorkspaceContext = z.infer<typeof workspaceContextSchema>;
export type WorkspaceInvitation = z.infer<typeof workspaceInvitationSchema>;
export type WorkspaceInvitationList = z.infer<typeof workspaceInvitationListSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export type NotificationItem = z.infer<typeof notificationSchema>;
export type NotificationList = z.infer<typeof notificationListSchema>;
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesInputSchema
>;
export type CaseStatus = z.infer<typeof caseStatusSchema>;
export type CaseDisposition = z.infer<typeof caseDispositionSchema>;
export type CaseIntent = z.infer<typeof caseIntentSchema>;
export type CasePublicationState = z.infer<typeof casePublicationStateSchema>;
export type CaseEvidence = z.infer<typeof caseEvidenceSchema>;
export type CaseAssessment = z.infer<typeof caseAssessmentSchema>;
export type CaseUpdate = z.infer<typeof caseUpdateSchema>;
export type CreateCaseUpdateInput = z.infer<typeof createCaseUpdateInputSchema>;
export type OperationsCaseSummary = z.infer<typeof operationsCaseSummarySchema>;
export type OperationsCaseList = z.infer<typeof operationsCaseListSchema>;
export type OperationsCaseDetail = z.infer<typeof operationsCaseDetailSchema>;
export type CreateCaseInput = z.infer<typeof createCaseInputSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseInputSchema>;
