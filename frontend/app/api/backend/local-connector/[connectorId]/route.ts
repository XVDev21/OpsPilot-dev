import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

interface ConnectorRouteProps {
  params: Promise<{ connectorId: string }>;
}

export async function DELETE(_: Request, { params }: ConnectorRouteProps) {
  try {
    const [{ connectorId }, accessToken] = await Promise.all([params, requireAccessToken()]);
    await djangoApi.deleteLocalConnector(accessToken, connectorId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
