import { ApiError, type ApiErrorPayload } from "@/lib/api/errors";
import {
  backendUserSchema,
  parseApiResponse,
  runListResponseSchema,
  workflowRunSchema,
} from "@/lib/api/schemas";
import type { WorkflowId } from "@/features/workflows/types";

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
  async getRun(runId: string) {
    return parseApiResponse(
      workflowRunSchema,
      await request<unknown>(`/api/backend/runs/${encodeURIComponent(runId)}`),
    );
  },
  async createRun(workflowId: WorkflowId, input: unknown) {
    return parseApiResponse(
      workflowRunSchema,
      await request<unknown>(`/api/backend/workflows/${workflowId}/runs`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
  deleteRun: (runId: string) =>
    request<void>(`/api/backend/runs/${encodeURIComponent(runId)}`, { method: "DELETE" }),
};
