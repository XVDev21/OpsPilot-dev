from typing import Any

from ninja import Schema
from pydantic import Field


class ApiErrorDetail(Schema):
    code: str
    message: str
    fieldErrors: dict[str, list[str]] = Field(default_factory=dict)
    requestId: str
    retryable: bool = False


class ApiErrorEnvelope(Schema):
    error: ApiErrorDetail


class HealthResponse(Schema):
    status: str
    service: str
    version: str


def error_envelope(
    *,
    code: str,
    message: str,
    request_id: str,
    field_errors: dict[str, list[str]] | None = None,
    retryable: bool = False,
) -> dict[str, dict[str, Any]]:
    return {
        "error": {
            "code": code,
            "message": message,
            "fieldErrors": field_errors or {},
            "requestId": request_id,
            "retryable": retryable,
        }
    }
