import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";
import { getWorkflow, isWorkflowId } from "@/features/workflows/registry";
import { createRunRequestSchema } from "@/lib/api/schemas";

interface WorkflowRunRouteProps {
  params: Promise<{ workflowId: string }>;
}

export async function POST(request: Request, { params }: WorkflowRunRouteProps) {
  try {
    const [{ workflowId }, accessToken] = await Promise.all([params, requireAccessToken()]);
    if (!isWorkflowId(workflowId)) {
      throw new ApiError({
        code: "UNKNOWN_WORKFLOW",
        message: "That workflow is not available.",
        retryable: false,
      }, 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError({
        code: "VALIDATION_ERROR",
        message: "The workflow input must be valid JSON.",
        retryable: false,
      }, 400);
    }

    const validatedRequest = createRunRequestSchema.safeParse(body);
    if (!validatedRequest.success) {
      throw new ApiError({
        code: "VALIDATION_ERROR",
        message: "Choose a supported provider and intelligence level.",
        retryable: false,
      }, 422);
    }

    const validatedInput = getWorkflow(workflowId).inputSchema.safeParse(validatedRequest.data.input);
    if (!validatedInput.success) {
      const fieldErrors = validatedInput.error.issues.reduce<Record<string, string[]>>(
        (errors, issue) => {
          const field = issue.path.join(".") || "form";
          errors[field] = [...(errors[field] ?? []), issue.message];
          return errors;
        },
        {},
      );
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "Review the highlighted workflow input and try again.",
          fieldErrors,
          retryable: false,
        },
        422,
      );
    }

    const run = await djangoApi.createRun(
      accessToken,
      workflowId,
      validatedInput.data,
      validatedRequest.data.options,
      validatedRequest.data.handoffId,
    );
    return Response.json(run, { status: run.status === "pending" ? 202 : 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
