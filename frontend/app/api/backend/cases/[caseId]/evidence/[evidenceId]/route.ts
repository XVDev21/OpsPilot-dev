import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

interface RouteProps {
  params: Promise<{ caseId: string; evidenceId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  try {
    const [{ caseId, evidenceId }, accessToken] = await Promise.all([
      params,
      requireAccessToken(),
    ]);
    await djangoApi.deleteEvidence(accessToken, caseId, evidenceId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
