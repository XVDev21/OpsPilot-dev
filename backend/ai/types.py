from dataclasses import dataclass
from typing import Literal, Protocol

from pydantic import BaseModel

type ProviderName = Literal["gemini", "openai", "qwen", "bedrock", "custom", "local"]
type IntelligenceLevel = Literal["fast", "balanced", "high"]
type CredentialSource = Literal["personal", "platform", "connector"]


@dataclass(frozen=True)
class ProviderResult:
    output: BaseModel
    input_tokens: int | None = None
    output_tokens: int | None = None


class ProviderFailure(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status: int,
        retryable: bool,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.retryable = retryable


class AIProvider(Protocol):
    def generate_structured(
        self,
        *,
        model: str,
        system_instruction: str,
        user_content: str,
        output_schema: type[BaseModel],
        max_output_tokens: int,
    ) -> ProviderResult: ...
