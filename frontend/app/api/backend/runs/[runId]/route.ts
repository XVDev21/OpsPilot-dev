import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

interface RunRouteProps {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: Request, { params }: RunRouteProps) {
  try {
    const [{ runId }, accessToken] = await Promise.all([params, requireAccessToken()]);
    return Response.json(await djangoApi.getRun(accessToken, runId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RunRouteProps) {
  try {
    const [{ runId }, accessToken] = await Promise.all([params, requireAccessToken()]);
    await djangoApi.deleteRun(accessToken, runId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
