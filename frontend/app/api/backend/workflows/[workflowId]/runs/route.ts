import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";
import { getWorkflow, isWorkflowId } from "@/features/workflows/registry";

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

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      throw new ApiError({
        code: "VALIDATION_ERROR",
        message: "The workflow input must be valid JSON.",
        retryable: false,
      }, 400);
    }

    const validatedInput = getWorkflow(workflowId).inputSchema.safeParse(input);
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

    return Response.json(
      await djangoApi.createRun(accessToken, workflowId, validatedInput.data),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
