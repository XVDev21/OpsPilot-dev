import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { updateCaseAssignmentInputSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/route-auth";

interface CaseAssignmentRouteProps {
  params: Promise<{ caseId: string }>;
}

export async function PUT(request: Request, { params }: CaseAssignmentRouteProps) {
  try {
    const [{ caseId }, accessToken] = await Promise.all([params, requireAccessToken()]);
    const input = updateCaseAssignmentInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      throw new ApiError(
        { code: "VALIDATION_ERROR", message: "Choose a workspace member.", retryable: false },
        422,
      );
    }
    return Response.json(
      await djangoApi.assignCase(accessToken, caseId, input.data.assigneeId),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
