import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function GET() {
  try {
    return Response.json(await djangoApi.listProviderCredentials(await requireAccessToken()));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
