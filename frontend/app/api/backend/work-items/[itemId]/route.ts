import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { updateWorkItemInputSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/route-auth";

interface WorkItemRouteProps {
  params: Promise<{ itemId: string }>;
}

export async function PATCH(request: Request, { params }: WorkItemRouteProps) {
  try {
    const [{ itemId }, accessToken] = await Promise.all([params, requireAccessToken()]);
    const input = updateWorkItemInputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "Review the work-item assignment, state, and due date.",
          retryable: false,
        },
        422,
      );
    }
    return Response.json(
      await djangoApi.updateWorkItem(accessToken, itemId, input.data),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
