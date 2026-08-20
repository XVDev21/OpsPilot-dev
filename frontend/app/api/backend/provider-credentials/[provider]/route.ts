import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { aiProviderSchema, providerCredentialInputSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/route-auth";

interface ProviderCredentialRouteProps {
  params: Promise<{ provider: string }>;
}

async function validatedProvider(params: ProviderCredentialRouteProps["params"]) {
  const result = aiProviderSchema.safeParse((await params).provider);
  if (!result.success) {
    throw new ApiError(
      {
        code: "NOT_FOUND",
        message: "That AI provider integration is not available.",
        retryable: false,
      },
      404,
    );
  }
  return result.data;
}

export async function PUT(request: Request, { params }: ProviderCredentialRouteProps) {
  try {
    const [provider, accessToken] = await Promise.all([
      validatedProvider(params),
      requireAccessToken(),
    ]);
    const body = await request.json().catch(() => null);
    const input = providerCredentialInputSchema.safeParse(body);
    if (!input.success) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "Review the provider credential fields and try again.",
          retryable: false,
        },
        422,
      );
    }
    return Response.json(
      await djangoApi.saveProviderCredential(accessToken, provider, input.data),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_: Request, { params }: ProviderCredentialRouteProps) {
  try {
    const [provider, accessToken] = await Promise.all([
      validatedProvider(params),
      requireAccessToken(),
    ]);
    await djangoApi.deleteProviderCredential(accessToken, provider);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
