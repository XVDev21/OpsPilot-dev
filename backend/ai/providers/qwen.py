import openai
from openai import OpenAI
from pydantic import BaseModel, ValidationError

from ai.types import ProviderFailure, ProviderResult


class QwenProvider:
    def __init__(self, *, api_key: str, base_url: str, timeout_seconds: int) -> None:
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout_seconds,
            max_retries=0,
        )

    def generate_structured(
        self,
        *,
        model: str,
        system_instruction: str,
        user_content: str,
        output_schema: type[BaseModel],
        max_output_tokens: int,
    ) -> ProviderResult:
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            f"{system_instruction}\nReturn only one valid JSON object that matches "
                            "the requested result contract."
                        ),
                    },
                    {"role": "user", "content": user_content},
                ],
                response_format={"type": "json_object"},
                max_completion_tokens=max_output_tokens,
                extra_body={"enable_thinking": False},
            )
            content = response.choices[0].message.content if response.choices else None
            if not content:
                raise ProviderFailure(
                    code="INVALID_AI_OUTPUT",
                    message="The AI provider returned no structured result.",
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
                message="The AI provider returned a result that could not be validated.",
                status=502,
                retryable=True,
            ) from exc
        except openai.AuthenticationError as exc:
            raise ProviderFailure(
                code="AI_AUTH_ERROR",
                message="The selected AI provider credential was rejected.",
                status=503,
                retryable=False,
            ) from exc
        except openai.RateLimitError as exc:
            raise ProviderFailure(
                code="AI_RATE_LIMITED",
                message="The AI provider is temporarily rate limited or has no available quota.",
                status=429,
                retryable=True,
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
