import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

interface RouteProps {
  params: Promise<{ caseId: string; attachmentId: string }>;
}

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const [{ caseId, attachmentId }, accessToken] = await Promise.all([
      params,
      requireAccessToken(),
    ]);
    const upstream = await djangoApi.caseUpdateImageContent(
      accessToken,
      caseId,
      attachmentId,
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition": upstream.headers.get("content-disposition") ?? "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
