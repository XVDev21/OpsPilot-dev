from urllib.parse import quote

import httpx
from pydantic import BaseModel, ValidationError

from ai.types import AIImage, ProviderFailure, ProviderResult


class BedrockProvider:
    def __init__(self, *, api_key: str, region: str, timeout_seconds: int) -> None:
        self.api_key = api_key
        self.region = region
        self.client = httpx.Client(
            timeout=timeout_seconds,
            follow_redirects=False,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
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
        schema = output_schema.model_json_schema()
        url = (
            f"https://bedrock-runtime.{self.region}.amazonaws.com/"
            f"model/{quote(model, safe='')}/converse"
        )
        try:
            response = self.client.post(
                url,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "system": [
                        {
                            "text": (
                                f"{system_instruction}\nReturn only one JSON object matching this "
                                f"JSON Schema: {schema}"
                            )
                        }
                    ],
                    "messages": [{"role": "user", "content": [{"text": user_content}]}],
                    "inferenceConfig": {
                        "maxTokens": max_output_tokens,
                        "temperature": 0,
                    },
                },
            )
            if response.status_code in {401, 403}:
                raise ProviderFailure(
                    code="AI_AUTH_ERROR",
                    message="The Amazon Bedrock API key was rejected or lacks model access.",
                    status=503,
                    retryable=False,
                )
            if response.status_code == 429:
                raise ProviderFailure(
                    code="AI_RATE_LIMITED",
                    message="Amazon Bedrock is temporarily rate limited or has no available quota.",
                    status=429,
                    retryable=True,
                )
            if response.status_code >= 500:
                raise ProviderFailure(
                    code="AI_UNAVAILABLE",
                    message="Amazon Bedrock is temporarily unavailable.",
                    status=503,
                    retryable=True,
                )
            if response.status_code >= 400:
                raise ProviderFailure(
                    code="AI_REQUEST_FAILED",
                    message="Amazon Bedrock could not process this workflow request.",
                    status=502,
                    retryable=False,
                )
            payload = response.json()
            content = payload.get("output", {}).get("message", {}).get("content", [])
            text = next(
                (
                    item.get("text")
                    for item in content
                    if isinstance(item, dict) and item.get("text")
                ),
                None,
            )
            if not text:
                raise ProviderFailure(
                    code="INVALID_AI_OUTPUT",
                    message="Amazon Bedrock returned no structured result.",
                    status=502,
                    retryable=True,
                )
            parsed = output_schema.model_validate_json(text)
            usage = payload.get("usage", {})
            return ProviderResult(
                output=parsed,
                input_tokens=usage.get("inputTokens"),
                output_tokens=usage.get("outputTokens"),
            )
        except ProviderFailure:
            raise
        except (ValidationError, ValueError, KeyError) as exc:
            raise ProviderFailure(
                code="INVALID_AI_OUTPUT",
                message="Amazon Bedrock returned a result that could not be validated.",
                status=502,
                retryable=True,
            ) from exc
        except httpx.TimeoutException as exc:
            raise ProviderFailure(
                code="AI_TIMEOUT",
                message="Amazon Bedrock took too long to respond.",
                status=504,
                retryable=True,
            ) from exc
        except httpx.HTTPError as exc:
            raise ProviderFailure(
                code="AI_UNAVAILABLE",
                message="Amazon Bedrock is temporarily unavailable.",
                status=503,
                retryable=True,
            ) from exc
