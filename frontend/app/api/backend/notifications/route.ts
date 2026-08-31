import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function GET(request: Request) {
  try {
    const source = new URL(request.url).searchParams;
    const query = new URLSearchParams();
    if (source.get("unreadOnly") === "true") query.set("unreadOnly", "true");
    const limit = Number(source.get("limit") || "30");
    query.set("limit", String(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 30));
    return Response.json(
      await djangoApi.listNotifications(await requireAccessToken(), `?${query}`),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
