import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

interface RouteProps {
  params: Promise<{ caseId: string }>;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 1024 * 1024;

function payloadTooLarge() {
  return new ApiError(
    {
      code: "EVIDENCE_PAYLOAD_TOO_LARGE",
      message: "Image evidence must be 8 MB or smaller.",
      retryable: false,
    },
    413,
  );
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const [{ caseId }, accessToken] = await Promise.all([
      params,
      requireAccessToken(),
    ]);
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_MULTIPART_BYTES
    ) {
      throw payloadTooLarge();
    }
    const source = await request.formData();
    const file = source.get("file");
    const caption = String(source.get("caption") ?? "").trim();
    if (file instanceof File && file.size > MAX_IMAGE_BYTES) {
      throw payloadTooLarge();
    }
    if (!(file instanceof File) || file.size === 0 || caption.length > 500) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message:
            "Choose a JPEG, PNG, or WebP image and keep its caption under 500 characters.",
          retryable: false,
        },
        422,
      );
    }
    const formData = new FormData();
    formData.set("file", file);
    return Response.json(
      await djangoApi.uploadImageEvidence(
        accessToken,
        caseId,
        formData,
        caption,
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
