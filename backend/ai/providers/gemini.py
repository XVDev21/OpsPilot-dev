import httpx
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from ai.types import AIImage, ProviderFailure, ProviderResult


class GeminiProvider:
    def __init__(self, *, api_key: str, timeout_seconds: int) -> None:
        self.client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=timeout_seconds * 1000),
        )

    def generate_structured(
        self,
        *,
        model: str,
        system_instruction: str,
        user_content: str,
        output_schema: type[BaseModel],
        max_output_tokens: int,
        images: tuple[AIImage, ...] = (),
    ) -> ProviderResult:
        try:
            response = self.client.models.generate_content(
                model=model,
                contents=[
                    user_content,
                    *[
                        types.Part.from_bytes(data=image.data, mime_type=image.mime_type)
                        for image in images
                    ],
                ],
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                    response_mime_type="application/json",
                    response_schema=output_schema,
                    max_output_tokens=max_output_tokens,
                    temperature=0.2,
                ),
            )
            parsed = response.parsed
            if parsed is None:
                parsed = output_schema.model_validate_json(response.text)
            elif not isinstance(parsed, output_schema):
                parsed = output_schema.model_validate(parsed)

            usage = response.usage_metadata
            return ProviderResult(
                output=parsed,
                input_tokens=getattr(usage, "prompt_token_count", None),
                output_tokens=getattr(usage, "candidates_token_count", None),
            )
        except ValidationError as exc:
            raise ProviderFailure(
                code="INVALID_AI_OUTPUT",
                message="The AI provider returned a result that could not be validated.",
                status=502,
                retryable=True,
            ) from exc
        except errors.APIError as exc:
            raise self._normalize_api_error(exc) from exc
        except (TimeoutError, httpx.TimeoutException) as exc:
            raise ProviderFailure(
                code="AI_TIMEOUT",
                message="The AI provider took too long to respond.",
                status=504,
                retryable=True,
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderFailure(
                code="AI_UNAVAILABLE",
                message="The AI provider is temporarily unavailable.",
                status=503,
                retryable=True,
            ) from exc

    @staticmethod
    def _normalize_api_error(exc: errors.APIError) -> ProviderFailure:
        if exc.code in {401, 403}:
            return ProviderFailure(
                code="AI_AUTH_ERROR",
                message="The selected AI provider is not configured correctly.",
                status=503,
                retryable=False,
            )
        if exc.code == 429:
            return ProviderFailure(
                code="AI_RATE_LIMITED",
                message="The AI provider is temporarily rate limited.",
                status=429,
                retryable=True,
            )
        if exc.code >= 500:
            return ProviderFailure(
                code="AI_UNAVAILABLE",
                message="The AI provider is temporarily unavailable.",
                status=503,
                retryable=True,
            )
        return ProviderFailure(
            code="AI_REQUEST_FAILED",
            message="The AI provider could not process this workflow request.",
            status=502,
            retryable=False,
        )
