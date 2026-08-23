import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { publishCaseInputSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/route-auth";

interface RouteProps {
  params: Promise<{ caseId: string }>;
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const [{ caseId }, accessToken] = await Promise.all([
      params,
      requireAccessToken(),
    ]);
    const input = publishCaseInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message:
            "Choose a valid workspace assignee or publish the case unassigned.",
          retryable: false,
        },
        422,
      );
    }
    return Response.json(
      await djangoApi.publishCase(accessToken, caseId, input.data.assigneeId),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
