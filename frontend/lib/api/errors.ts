export interface ApiErrorPayload {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string | null;
  retryable?: boolean;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;
  readonly requestId: string | null;
  readonly retryable: boolean;

  constructor(payload: ApiErrorPayload, status = 500) {
    super(payload.message);
    this.name = "ApiError";
    this.code = payload.code;
    this.status = status;
    this.fieldErrors = payload.fieldErrors ?? {};
    this.requestId = payload.requestId ?? null;
    this.retryable = payload.retryable ?? false;
  }
}

export function apiErrorResponse(error: unknown) {
  const normalized =
    error instanceof ApiError
      ? error
      : new ApiError({
          code: "INTERNAL_ERROR",
          message: "OpsPilot could not complete that request.",
          retryable: false,
        });

  return Response.json(
    {
      error: {
        code: normalized.code,
        message: normalized.message,
        fieldErrors: normalized.fieldErrors,
        requestId: normalized.requestId,
        retryable: normalized.retryable,
      },
    },
    { status: normalized.status },
  );
}
