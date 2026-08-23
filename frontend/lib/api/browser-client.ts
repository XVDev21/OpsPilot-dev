import { ApiError, type ApiErrorPayload } from "@/lib/api/errors";
import {
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
  runListResponseSchema,
  workflowRunSchema,
  workspaceMemberListSchema,
  operationsCaseListSchema,
  operationsCaseDetailSchema,
} from "@/lib/api/schemas";
import type { WorkflowId } from "@/features/workflows/types";
import type {
  AIProvider,
  CreateCaseInput,
  IntelligenceLevel,
  ProviderCredentialInput,
  UpdateCaseInput,
  WorkItemUpdate,
} from "@/lib/api/types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(path, {
      ...options,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...options?.headers },
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: ApiErrorPayload } | null;
      const requestId = payload?.error?.requestId ?? response.headers.get("x-request-id");
      const retryableStatus = response.status === 408 || response.status === 429 || response.status >= 500;
      throw new ApiError(
        {
          code: payload?.error?.code ?? "API_REQUEST_FAILED",
          message: payload?.error?.message ?? "OpsPilot could not complete that request.",
          fieldErrors: payload?.error?.fieldErrors,
          requestId,
          retryable: payload?.error?.retryable ?? retryableStatus,
        },
        response.status,
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      {
        code: "BACKEND_UNAVAILABLE",
        message: "The live API is unavailable. Your input is still here, and Demo Mode remains available.",
        retryable: true,
      },
      503,
    );
  }
}

export const browserApi = {
  async currentUser() {
    return parseApiResponse(backendUserSchema, await request<unknown>("/api/backend/me"));
  },
  async listRuns() {
    return parseApiResponse(runListResponseSchema, await request<unknown>("/api/backend/runs"));
  },
  async executionOptions() {
    return parseApiResponse(
      executionOptionsSchema,
      await request<unknown>("/api/backend/execution-options"),
    );
  },
  async listProviderCredentials() {
    return parseApiResponse(
      providerCredentialListSchema,
      await request<unknown>("/api/backend/provider-credentials"),
    );
  },
  async saveProviderCredential(provider: AIProvider, input: ProviderCredentialInput) {
    return parseApiResponse(
      providerCredentialSummarySchema,
      await request<unknown>(`/api/backend/provider-credentials/${provider}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    );
  },
  deleteProviderCredential: (provider: AIProvider) =>
    request<void>(`/api/backend/provider-credentials/${provider}`, { method: "DELETE" }),
  async getRun(runId: string) {
    return parseApiResponse(
      workflowRunSchema,
      await request<unknown>(`/api/backend/runs/${encodeURIComponent(runId)}`),
    );
  },
  async createRun(
    workflowId: WorkflowId,
    input: unknown,
    options: { provider: AIProvider; intelligence: IntelligenceLevel },
    handoffId?: string | null,
    caseId?: string | null,
  ) {
    return parseApiResponse(
      workflowRunSchema,
      await request<unknown>(`/api/backend/workflows/${workflowId}/runs`, {
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
  deleteRun: (runId: string) =>
    request<void>(`/api/backend/runs/${encodeURIComponent(runId)}`, { method: "DELETE" }),
  async getLocalConnector() {
    return parseApiResponse(
      localConnectorEnvelopeSchema,
      await request<unknown>("/api/backend/local-connector"),
    );
  },
  async createLocalConnectorPairing(input: { name: string; modelFast: string; modelBalanced: string; modelHigh: string }) {
    return parseApiResponse(
      localConnectorPairingSchema,
      await request<unknown>("/api/backend/local-connector/pairing", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
  deleteLocalConnector: (connectorId: string) =>
    request<void>(`/api/backend/local-connector/${encodeURIComponent(connectorId)}`, { method: "DELETE" }),
  async createHandoff(runId: string, target: "work-item" | "meeting-actions" | "status-update") {
    return parseApiResponse(
      workflowHandoffSchema,
      await request<unknown>(`/api/backend/runs/${encodeURIComponent(runId)}/handoffs`, {
        method: "POST",
        body: JSON.stringify({ target }),
      }),
    );
  },
  async getHandoff(handoffId: string) {
    return parseApiResponse(
      workflowHandoffSchema,
      await request<unknown>(`/api/backend/handoffs/${encodeURIComponent(handoffId)}`),
    );
  },
  async listWorkItems(filters?: { status?: string; assigneeId?: string; caseId?: string }) {
    const query = new URLSearchParams();
    if (filters?.status) query.set("status", filters.status);
    if (filters?.assigneeId) query.set("assigneeId", filters.assigneeId);
    if (filters?.caseId) query.set("caseId", filters.caseId);
    const suffix = query.size ? `?${query}` : "";
    return parseApiResponse(
      workItemListSchema,
      await request<unknown>(`/api/backend/work-items${suffix}`),
    );
  },
  async createWorkItem(input: {
    handoffId?: string | null;
    caseId?: string | null;
    title: string;
    description: string;
    kind: "engineering" | "verification" | "investigation" | "follow-up";
    assigneeId?: string | null;
    dueDate?: string | null;
  }) {
    return parseApiResponse(
      workItemSchema,
      await request<unknown>("/api/backend/work-items", { method: "POST", body: JSON.stringify(input) }),
    );
  },
  async updateWorkItem(itemId: string, input: WorkItemUpdate) {
    return parseApiResponse(
      workItemSchema,
      await request<unknown>(`/api/backend/work-items/${encodeURIComponent(itemId)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  },
  async listWorkspaceMembers() {
    return parseApiResponse(
      workspaceMemberListSchema,
      await request<unknown>("/api/backend/workspace/members"),
    );
  },
  async listCases(filters?: Record<string, string>) {
    const query = new URLSearchParams(filters);
    const suffix = query.size ? `?${query}` : "";
    return parseApiResponse(
      operationsCaseListSchema,
      await request<unknown>(`/api/backend/cases${suffix}`),
    );
  },
  async createCase(input: CreateCaseInput) {
    return parseApiResponse(
      operationsCaseDetailSchema,
      await request<unknown>("/api/backend/cases", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
  async getCase(caseId: string) {
    return parseApiResponse(
      operationsCaseDetailSchema,
      await request<unknown>(`/api/backend/cases/${encodeURIComponent(caseId)}`),
    );
  },
  async updateCase(caseId: string, input: UpdateCaseInput) {
    return parseApiResponse(
      operationsCaseDetailSchema,
      await request<unknown>(`/api/backend/cases/${encodeURIComponent(caseId)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  },
  async assignCase(caseId: string, assigneeId: string | null) {
    return parseApiResponse(
      operationsCaseDetailSchema,
      await request<unknown>(`/api/backend/cases/${encodeURIComponent(caseId)}/assignment`, {
        method: "PUT",
        body: JSON.stringify({ assigneeId }),
      }),
    );
  },
};
