import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

interface RouteProps {
  params: Promise<{ caseId: string; updateId: string }>;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const [{ caseId, updateId }, accessToken] = await Promise.all([
      params,
      requireAccessToken(),
    ]);
    const source = await request.formData();
    const file = source.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "Choose a JPEG, PNG, or WebP image no larger than 8 MB.",
          retryable: false,
        },
        422,
      );
    }
    const formData = new FormData();
    formData.set("file", file);
    return Response.json(
      await djangoApi.uploadCaseUpdateImage(
        accessToken,
        caseId,
        updateId,
        formData,
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
