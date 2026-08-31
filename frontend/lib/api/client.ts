import "server-only";

import { ApiError, type ApiErrorPayload } from "@/lib/api/errors";
import {
  backendRunListSchema,
  backendUserSchema,
  executionOptionsSchema,
  parseApiResponse,
  providerCredentialListSchema,
  providerCredentialSummarySchema,
  localConnectorEnvelopeSchema,
  localConnectorPairingSchema,
  workflowHandoffSchema,
  workItemListSchema,
  workItemSchema,
  workflowRunSchema,
  workspaceMemberListSchema,
  workspaceContextSchema,
  workspaceInvitationListSchema,
  workspaceInvitationSchema,
  workspaceRosterMemberSchema,
  workspaceReconciliationSchema,
  notificationListSchema,
  notificationPreferencesSchema,
  notificationSchema,
  operationsCaseListSchema,
  operationsCaseDetailSchema,
  caseEvidenceSchema,
  caseUpdateSchema,
  caseUpdateAttachmentSchema,
} from "@/lib/api/schemas";
import type { WorkflowId } from "@/features/workflows/types";
import type {
  AIProvider,
  CreateCaseInput,
  CreateCaseUpdateInput,
  IntelligenceLevel,
  ProviderCredentialInput,
  UpdateCaseInput,
  UpdateNotificationPreferencesInput,
  WorkItemUpdate,
} from "@/lib/api/types";

const requestTimeoutMs = 30_000;

interface RequestOptions extends Omit<RequestInit, "headers"> {
  accessToken: string;
  headers?: HeadersInit;
}

function getApiBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!value) {
    throw new ApiError(
      {
        code: "BACKEND_UNAVAILABLE",
        message: "The live API has not been configured for this environment.",
        retryable: false,
      },
      503,
    );
  }
  return value;
}

async function parseError(response: Response): Promise<ApiError> {
  let payload: { error?: ApiErrorPayload } | null = null;
  try {
    payload = (await response.json()) as { error?: ApiErrorPayload };
  } catch {
    payload = null;
  }
  const requestId =
    payload?.error?.requestId ?? response.headers.get("x-request-id");
  const retryableStatus =
    response.status === 408 ||
    response.status === 429 ||
    response.status >= 500;
  return new ApiError(
    {
      code:
        payload?.error?.code ??
        (response.status === 401 ? "INVALID_TOKEN" : "API_REQUEST_FAILED"),
      message:
        payload?.error?.message ??
        (response.status === 401
          ? "Your session could not be authorized for the live API."
          : "The live API returned an unexpected response."),
      fieldErrors: payload?.error?.fieldErrors,
      requestId,
      retryable: payload?.error?.retryable ?? retryableStatus,
    },
    response.status,
  );
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${options.accessToken}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1${path}`, {
      ...options,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw await parseError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        {
          code: "API_TIMEOUT",
          message: "The live API took too long to respond.",
          retryable: true,
        },
        504,
      );
    }
    throw new ApiError(
      {
        code: "BACKEND_UNAVAILABLE",
        message:
          "The live API is unavailable. Your input is still here, and Demo Mode remains available.",
        retryable: true,
      },
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function requestFile(
  path: string,
  accessToken: string,
): Promise<Response> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw await parseError(response);
  return response;
}

export const djangoApi = {
  async currentUser(accessToken: string) {
    return parseApiResponse(
      backendUserSchema,
      await request<unknown>("/me", { accessToken }),
    );
  },
  async listRuns(accessToken: string) {
    return parseApiResponse(
      backendRunListSchema,
      await request<unknown>("/runs", { accessToken }),
    );
  },
  async executionOptions(accessToken: string) {
    return parseApiResponse(
      executionOptionsSchema,
      await request<unknown>("/execution-options", { accessToken }),
    );
  },
  async listProviderCredentials(accessToken: string) {
    return parseApiResponse(
      providerCredentialListSchema,
      await request<unknown>("/provider-credentials", { accessToken }),
    );
  },
  async saveProviderCredential(
    accessToken: string,
    provider: AIProvider,
    input: ProviderCredentialInput,
  ) {
    return parseApiResponse(
      providerCredentialSummarySchema,
      await request<unknown>(`/provider-credentials/${provider}`, {
        accessToken,
        method: "PUT",
        body: JSON.stringify(input),
      }),
    );
  },
  deleteProviderCredential(accessToken: string, provider: AIProvider) {
    return request<void>(`/provider-credentials/${provider}`, {
      accessToken,
      method: "DELETE",
    });
  },
  async getRun(accessToken: string, runId: string) {
    return parseApiResponse(
      workflowRunSchema,
      await request<unknown>(`/runs/${encodeURIComponent(runId)}`, {
        accessToken,
      }),
    );
  },
  async createRun(
    accessToken: string,
    workflowId: WorkflowId,
    input: unknown,
    options: { provider: AIProvider; intelligence: IntelligenceLevel },
    handoffId?: string | null,
    caseId?: string | null,
  ) {
    return parseApiResponse(
      workflowRunSchema,
      await request<unknown>(`/workflows/${workflowId}/runs`, {
        accessToken,
        method: "POST",
        body: JSON.stringify({
          input,
          options,
          ...(handoffId ? { handoffId } : {}),
          ...(caseId ? { caseId } : {}),
        }),
      }),
    );
  },
  deleteRun(accessToken: string, runId: string) {
    return request<void>(`/runs/${encodeURIComponent(runId)}`, {
      accessToken,
      method: "DELETE",
    });
  },
  async getLocalConnector(accessToken: string) {
    return parseApiResponse(
      localConnectorEnvelopeSchema,
      await request<unknown>("/local-connector", { accessToken }),
    );
  },
  async createLocalConnectorPairing(
    accessToken: string,
    input: {
      name: string;
      modelFast: string;
      modelBalanced: string;
      modelHigh: string;
    },
  ) {
    return parseApiResponse(
      localConnectorPairingSchema,
      await request<unknown>("/local-connector/pairing", {
        accessToken,
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
  deleteLocalConnector(accessToken: string, connectorId: string) {
    return request<void>(
      `/local-connector/${encodeURIComponent(connectorId)}`,
      {
        accessToken,
        method: "DELETE",
      },
    );
  },
  async createHandoff(
    accessToken: string,
    runId: string,
    target: "work-item" | "meeting-actions" | "status-update",
  ) {
    return parseApiResponse(
      workflowHandoffSchema,
      await request<unknown>(`/runs/${encodeURIComponent(runId)}/handoffs`, {
        accessToken,
        method: "POST",
        body: JSON.stringify({ target }),
      }),
    );
  },
  async getHandoff(accessToken: string, handoffId: string) {
    return parseApiResponse(
      workflowHandoffSchema,
      await request<unknown>(`/handoffs/${encodeURIComponent(handoffId)}`, {
        accessToken,
      }),
    );
  },
  async listWorkItems(accessToken: string, search = "") {
    return parseApiResponse(
      workItemListSchema,
      await request<unknown>(`/work-items${search}`, { accessToken }),
    );
  },
  async createWorkItem(accessToken: string, input: unknown) {
    return parseApiResponse(
      workItemSchema,
      await request<unknown>("/work-items", {
        accessToken,
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
  async updateWorkItem(
    accessToken: string,
    itemId: string,
    input: WorkItemUpdate,
  ) {
    return parseApiResponse(
      workItemSchema,
      await request<unknown>(`/work-items/${encodeURIComponent(itemId)}`, {
        accessToken,
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  },
  async listWorkspaceMembers(accessToken: string) {
    return parseApiResponse(
      workspaceMemberListSchema,
      await request<unknown>("/workspace/members", { accessToken }),
    );
  },
  async workspaceContext(accessToken: string) {
    return parseApiResponse(
      workspaceContextSchema,
      await request<unknown>("/workspace", { accessToken }),
    );
  },
  async activateWorkspaceCollaboration(accessToken: string, name?: string) {
    return parseApiResponse(
      workspaceContextSchema,
      await request<unknown>("/workspace/collaboration", {
        accessToken,
        method: "POST",
        body: JSON.stringify({ name: name || null }),
      }),
    );
  },
  async listWorkspaceInvitations(accessToken: string) {
    return parseApiResponse(
      workspaceInvitationListSchema,
      await request<unknown>("/workspace/invitations", { accessToken }),
    );
  },
  async inviteWorkspaceMember(
    accessToken: string,
    input: { email: string; accessRole: "operator" | "contributor" | "viewer"; targetMemberId?: string | null },
  ) {
    return parseApiResponse(
      workspaceInvitationSchema,
      await request<unknown>("/workspace/invitations", {
        accessToken,
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
  async updateWorkspaceMember(
    accessToken: string,
    memberId: string,
    input: { accessRole?: "operator" | "contributor" | "viewer"; active?: boolean },
  ) {
    return parseApiResponse(
      workspaceRosterMemberSchema,
      await request<unknown>(`/workspace/members/${encodeURIComponent(memberId)}`, {
        accessToken,
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  },
  async revokeWorkspaceInvitation(accessToken: string, invitationId: string) {
    return parseApiResponse(
      workspaceInvitationSchema,
      await request<unknown>(`/workspace/invitations/${encodeURIComponent(invitationId)}/revoke`, {
        accessToken,
        method: "POST",
      }),
    );
  },
  async resendWorkspaceInvitation(accessToken: string, invitationId: string) {
    return parseApiResponse(
      workspaceInvitationSchema,
      await request<unknown>(`/workspace/invitations/${encodeURIComponent(invitationId)}/resend`, {
        accessToken,
        method: "POST",
      }),
    );
  },
  async reconcileWorkspace(accessToken: string) {
    return parseApiResponse(
      workspaceReconciliationSchema,
      await request<unknown>("/workspace/reconcile", { accessToken, method: "POST" }),
    );
  },
  async listNotifications(accessToken: string, search = "") {
    return parseApiResponse(
      notificationListSchema,
      await request<unknown>(`/notifications${search}`, { accessToken }),
    );
  },
  async markNotificationRead(accessToken: string, notificationId: string) {
    return parseApiResponse(
      notificationSchema,
      await request<unknown>(
        `/notifications/${encodeURIComponent(notificationId)}/read`,
        { accessToken, method: "PATCH" },
      ),
    );
  },
  markAllNotificationsRead(accessToken: string) {
    return request<{ updated: number }>("/notifications/read-all", {
      accessToken,
      method: "POST",
    });
  },
  async notificationPreferences(accessToken: string) {
    return parseApiResponse(
      notificationPreferencesSchema,
      await request<unknown>("/notification-preferences", { accessToken }),
    );
  },
  async updateNotificationPreferences(
    accessToken: string,
    input: UpdateNotificationPreferencesInput,
  ) {
    return parseApiResponse(
      notificationPreferencesSchema,
      await request<unknown>("/notification-preferences", {
        accessToken,
        method: "PUT",
        body: JSON.stringify(input),
      }),
    );
  },
  async listCases(accessToken: string, search = "") {
    return parseApiResponse(
      operationsCaseListSchema,
      await request<unknown>(`/cases${search}`, { accessToken }),
    );
  },
  async createCase(accessToken: string, input: CreateCaseInput) {
    return parseApiResponse(
      operationsCaseDetailSchema,
      await request<unknown>("/cases", {
        accessToken,
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
  async getCase(accessToken: string, caseId: string) {
    return parseApiResponse(
      operationsCaseDetailSchema,
      await request<unknown>(`/cases/${encodeURIComponent(caseId)}`, {
        accessToken,
      }),
    );
  },
  async updateCase(
    accessToken: string,
    caseId: string,
    input: UpdateCaseInput,
  ) {
    return parseApiResponse(
      operationsCaseDetailSchema,
      await request<unknown>(`/cases/${encodeURIComponent(caseId)}`, {
        accessToken,
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  },
  async assignCase(
    accessToken: string,
    caseId: string,
    assigneeId: string | null,
  ) {
    return parseApiResponse(
      operationsCaseDetailSchema,
      await request<unknown>(
        `/cases/${encodeURIComponent(caseId)}/assignment`,
        {
          accessToken,
          method: "PUT",
          body: JSON.stringify({ assigneeId }),
        },
      ),
    );
  },
  async publishCase(
    accessToken: string,
    caseId: string,
    input: {
      assigneeId: string | null;
      assessmentId?: string | null;
      overrideAdvisory?: boolean;
    },
  ) {
    return parseApiResponse(
      operationsCaseDetailSchema,
      await request<unknown>(`/cases/${encodeURIComponent(caseId)}/publish`, {
        accessToken,
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
  async createCaseUpdate(
    accessToken: string,
    caseId: string,
    input: CreateCaseUpdateInput,
  ) {
    return parseApiResponse(
      caseUpdateSchema,
      await request<unknown>(`/cases/${encodeURIComponent(caseId)}/updates`, {
        accessToken,
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
  async uploadCaseUpdateImage(
    accessToken: string,
    caseId: string,
    updateId: string,
    formData: FormData,
  ) {
    return parseApiResponse(
      caseUpdateAttachmentSchema,
      await request<unknown>(
        `/cases/${encodeURIComponent(caseId)}/updates/${encodeURIComponent(updateId)}/images`,
        { accessToken, method: "POST", body: formData },
      ),
    );
  },
  async addTextEvidence(accessToken: string, caseId: string, text: string) {
    return parseApiResponse(
      caseEvidenceSchema,
      await request<unknown>(
        `/cases/${encodeURIComponent(caseId)}/evidence/text`,
        {
          accessToken,
          method: "POST",
          body: JSON.stringify({ text }),
        },
      ),
    );
  },
  async uploadImageEvidence(
    accessToken: string,
    caseId: string,
    formData: FormData,
    caption: string,
  ) {
    return parseApiResponse(
      caseEvidenceSchema,
      await request<unknown>(
        `/cases/${encodeURIComponent(caseId)}/evidence/images?caption=${encodeURIComponent(caption)}`,
        {
          accessToken,
          method: "POST",
          body: formData,
        },
      ),
    );
  },
  deleteEvidence(accessToken: string, caseId: string, evidenceId: string) {
    return request<void>(
      `/cases/${encodeURIComponent(caseId)}/evidence/${encodeURIComponent(evidenceId)}`,
      { accessToken, method: "DELETE" },
    );
  },
  evidenceContent(accessToken: string, caseId: string, evidenceId: string) {
    return requestFile(
      `/cases/${encodeURIComponent(caseId)}/evidence/${encodeURIComponent(evidenceId)}/content`,
      accessToken,
    );
  },
  caseUpdateImageContent(
    accessToken: string,
    caseId: string,
    attachmentId: string,
  ) {
    return requestFile(
      `/cases/${encodeURIComponent(caseId)}/updates/attachments/${encodeURIComponent(attachmentId)}/content`,
      accessToken,
    );
  },
  async createCaseAssessment(
    accessToken: string,
    caseId: string,
    options: { provider: AIProvider; intelligence: IntelligenceLevel },
  ) {
    return parseApiResponse(
      workflowRunSchema,
      await request<unknown>(
        `/cases/${encodeURIComponent(caseId)}/assessments`,
        {
          accessToken,
          method: "POST",
          body: JSON.stringify(options),
        },
      ),
    );
  },
  async applyCaseAssessment(
    accessToken: string,
    caseId: string,
    assessmentId: string,
  ) {
    return parseApiResponse(
      operationsCaseDetailSchema,
      await request<unknown>(
        `/cases/${encodeURIComponent(caseId)}/assessments/${encodeURIComponent(assessmentId)}/apply`,
        { accessToken, method: "POST" },
      ),
    );
  },
};
