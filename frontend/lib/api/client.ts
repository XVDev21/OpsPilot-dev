import "server-only";

import { ApiError, type ApiErrorPayload } from "@/lib/api/errors";
import {
  backendRunListSchema,
  backendUserSchema,
  executionOptionsSchema,
  parseApiResponse,
  providerCredentialListSchema,
  providerCredentialSummarySchema,
  workflowRunSchema,
} from "@/lib/api/schemas";
import type { WorkflowId } from "@/features/workflows/types";
import type { AIProvider, IntelligenceLevel, ProviderCredentialInput } from "@/lib/api/types";

const requestTimeoutMs = 30_000;

interface RequestOptions extends Omit<RequestInit, "headers"> {
  accessToken: string;
  headers?: HeadersInit;
}

function getApiBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!value) {
    throw new ApiError({
      code: "BACKEND_UNAVAILABLE",
      message: "The live API has not been configured for this environment.",
      retryable: false,
    }, 503);
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
  const requestId = payload?.error?.requestId ?? response.headers.get("x-request-id");
  const retryableStatus = response.status === 408 || response.status === 429 || response.status >= 500;
  return new ApiError(
    {
      code: payload?.error?.code ?? (response.status === 401 ? "INVALID_TOKEN" : "API_REQUEST_FAILED"),
      message: payload?.error?.message ??
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
  if (options.body) headers.set("Content-Type", "application/json");

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
      throw new ApiError({
        code: "API_TIMEOUT",
        message: "The live API took too long to respond.",
        retryable: true,
      }, 504);
    }
    throw new ApiError({
      code: "BACKEND_UNAVAILABLE",
      message: "The live API is unavailable. Your input is still here, and Demo Mode remains available.",
      retryable: true,
    }, 503);
  } finally {
    clearTimeout(timeout);
  }
}

export const djangoApi = {
  async currentUser(accessToken: string) {
    return parseApiResponse(backendUserSchema, await request<unknown>("/me", { accessToken }));
  },
  async listRuns(accessToken: string) {
    return parseApiResponse(backendRunListSchema, await request<unknown>("/runs", { accessToken }));
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
      await request<unknown>(`/runs/${encodeURIComponent(runId)}`, { accessToken }),
    );
  },
  async createRun(
    accessToken: string,
    workflowId: WorkflowId,
    input: unknown,
    options: { provider: AIProvider; intelligence: IntelligenceLevel },
  ) {
    return parseApiResponse(
      workflowRunSchema,
      await request<unknown>(`/workflows/${workflowId}/runs`, {
        accessToken,
        method: "POST",
        body: JSON.stringify({ input, options }),
      }),
    );
  },
  deleteRun(accessToken: string, runId: string) {
    return request<void>(`/runs/${encodeURIComponent(runId)}`, {
      accessToken,
      method: "DELETE",
    });
  },
};
