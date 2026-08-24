import openai
from openai import OpenAI
from pydantic import BaseModel, ValidationError

from ai.types import AIImage, ProviderFailure, ProviderResult


class OpenAIProvider:
    def __init__(self, *, api_key: str, timeout_seconds: int) -> None:
        self.client = OpenAI(api_key=api_key, timeout=timeout_seconds, max_retries=0)

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
        if images:
            raise ProviderFailure(
                code="MODEL_CAPABILITY_MISMATCH",
                message="This provider route is not verified for image evidence yet.",
                status=422,
                retryable=False,
            )
        try:
            response = self.client.responses.parse(
                model=model,
                instructions=system_instruction,
                input=user_content,
                text_format=output_schema,
                max_output_tokens=max_output_tokens,
                store=False,
            )
            parsed = response.output_parsed
            if parsed is None:
                raise ProviderFailure(
                    code="INVALID_AI_OUTPUT",
                    message="The AI provider returned no structured result.",
                    status=502,
                    retryable=True,
                )
            if not isinstance(parsed, output_schema):
                parsed = output_schema.model_validate(parsed)
            usage = response.usage
            return ProviderResult(
                output=parsed,
                input_tokens=getattr(usage, "input_tokens", None),
                output_tokens=getattr(usage, "output_tokens", None),
            )
        except ProviderFailure:
            raise
        except ValidationError as exc:
            raise ProviderFailure(
                code="INVALID_AI_OUTPUT",
                message="The AI provider returned a result that could not be validated.",
                status=502,
                retryable=True,
            ) from exc
        except openai.AuthenticationError as exc:
            raise ProviderFailure(
                code="AI_AUTH_ERROR",
                message="The selected AI provider is not configured correctly.",
                status=503,
                retryable=False,
            ) from exc
        except openai.RateLimitError as exc:
            quota_exhausted = exc.code == "insufficient_quota"
            raise ProviderFailure(
                code="AI_RATE_LIMITED",
                message=(
                    "The selected AI provider has no available quota."
                    if quota_exhausted
                    else "The AI provider is temporarily rate limited."
                ),
                status=429,
                retryable=not quota_exhausted,
            ) from exc
        except openai.APITimeoutError as exc:
            raise ProviderFailure(
                code="AI_TIMEOUT",
                message="The AI provider took too long to respond.",
                status=504,
                retryable=True,
            ) from exc
        except openai.APIConnectionError as exc:
            raise ProviderFailure(
                code="AI_UNAVAILABLE",
                message="The AI provider is temporarily unavailable.",
                status=503,
                retryable=True,
            ) from exc
        except openai.APIStatusError as exc:
            retryable = exc.status_code >= 500
            raise ProviderFailure(
                code="AI_UNAVAILABLE" if retryable else "AI_REQUEST_FAILED",
                message=(
                    "The AI provider is temporarily unavailable."
                    if retryable
                    else "The AI provider could not process this workflow request."
                ),
                status=503 if retryable else 502,
                retryable=retryable,
            ) from exc
