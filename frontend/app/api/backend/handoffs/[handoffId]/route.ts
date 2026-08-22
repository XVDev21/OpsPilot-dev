import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

interface HandoffRouteProps {
  params: Promise<{ handoffId: string }>;
}

export async function GET(_: Request, { params }: HandoffRouteProps) {
  try {
    const [{ handoffId }, accessToken] = await Promise.all([params, requireAccessToken()]);
    return Response.json(await djangoApi.getHandoff(accessToken, handoffId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
