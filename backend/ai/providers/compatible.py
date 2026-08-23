import httpx
import openai
from openai import DefaultHttpxClient, OpenAI
from pydantic import BaseModel, ValidationError

from ai.types import AIImage, ProviderFailure, ProviderResult


class OpenAICompatibleProvider:
    def __init__(self, *, api_key: str, base_url: str, timeout_seconds: int) -> None:
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            max_retries=0,
            http_client=DefaultHttpxClient(
                timeout=timeout_seconds,
                follow_redirects=False,
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            ),
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
        if images:
            raise ProviderFailure(
                code="MODEL_CAPABILITY_MISMATCH",
                message="This provider route is not verified for image evidence yet.",
                status=422,
                retryable=False,
            )
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            f"{system_instruction}\nReturn only one valid JSON object matching "
                            f"this JSON Schema: {output_schema.model_json_schema()}"
                        ),
                    },
                    {"role": "user", "content": user_content},
                ],
                response_format={"type": "json_object"},
                max_tokens=max_output_tokens,
                temperature=0,
            )
            content = response.choices[0].message.content if response.choices else None
            if not content:
                raise ProviderFailure(
                    code="INVALID_AI_OUTPUT",
                    message="The custom model returned no structured result.",
                    status=502,
                    retryable=True,
                )
            parsed = output_schema.model_validate_json(content)
            usage = response.usage
            return ProviderResult(
                output=parsed,
                input_tokens=getattr(usage, "prompt_tokens", None),
                output_tokens=getattr(usage, "completion_tokens", None),
            )
        except ProviderFailure:
            raise
        except ValidationError as exc:
            raise ProviderFailure(
                code="INVALID_AI_OUTPUT",
                message="The custom model returned a result that could not be validated.",
                status=502,
                retryable=True,
            ) from exc
        except openai.AuthenticationError as exc:
            raise ProviderFailure(
                code="AI_AUTH_ERROR",
                message="The custom model credential was rejected.",
                status=503,
                retryable=False,
            ) from exc
        except openai.RateLimitError as exc:
            raise ProviderFailure(
                code="AI_RATE_LIMITED",
                message="The custom model endpoint is temporarily rate limited.",
                status=429,
                retryable=True,
            ) from exc
        except openai.APITimeoutError as exc:
            raise ProviderFailure(
                code="AI_TIMEOUT",
                message="The custom model endpoint took too long to respond.",
                status=504,
                retryable=True,
            ) from exc
        except openai.APIConnectionError as exc:
            raise ProviderFailure(
                code="AI_UNAVAILABLE",
                message="The custom model endpoint is unavailable.",
                status=503,
                retryable=True,
            ) from exc
        except openai.APIStatusError as exc:
            retryable = exc.status_code >= 500
            raise ProviderFailure(
                code="AI_UNAVAILABLE" if retryable else "AI_REQUEST_FAILED",
                message=(
                    "The custom model endpoint is unavailable."
                    if retryable
                    else "The custom model endpoint rejected this workflow request."
                ),
                status=503 if retryable else 502,
                retryable=retryable,
            ) from exc
