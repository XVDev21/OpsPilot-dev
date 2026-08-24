import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

interface RouteProps {
  params: Promise<{ caseId: string; assessmentId: string }>;
}

export async function POST(_request: Request, { params }: RouteProps) {
  try {
    const [{ caseId, assessmentId }, accessToken] = await Promise.all([
      params,
      requireAccessToken(),
    ]);
    return Response.json(
      await djangoApi.applyCaseAssessment(accessToken, caseId, assessmentId),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
