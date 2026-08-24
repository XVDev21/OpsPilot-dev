import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

interface RouteProps {
  params: Promise<{ caseId: string; evidenceId: string }>;
}

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const [{ caseId, evidenceId }, accessToken] = await Promise.all([
      params,
      requireAccessToken(),
    ]);
    const upstream = await djangoApi.evidenceContent(
      accessToken,
      caseId,
      evidenceId,
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/octet-stream",
        "Content-Disposition":
          upstream.headers.get("content-disposition") ?? "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
