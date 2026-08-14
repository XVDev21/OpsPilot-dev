import logging
from collections import defaultdict

from django.http import Http404, HttpRequest
from ninja import NinjaAPI
from ninja.errors import AuthenticationError, ValidationError

from common.schemas import error_envelope

logger = logging.getLogger(__name__)


class OpsPilotError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status: int,
        retryable: bool = False,
        field_errors: dict[str, list[str]] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.retryable = retryable
        self.field_errors = field_errors or {}


def request_id(request: HttpRequest) -> str:
    return getattr(request, "request_id", "unavailable")


def validation_field_errors(exc: ValidationError) -> dict[str, list[str]]:
    errors: defaultdict[str, list[str]] = defaultdict(list)
    for item in exc.errors:
        location = item.get("loc") or ()
        path = ".".join(str(part) for part in location if part not in {"body", "query", "path"})
        errors[path or "request"].append(str(item.get("msg", "Invalid value.")))
    return dict(errors)


def register_error_handlers(api: NinjaAPI) -> None:
    @api.exception_handler(OpsPilotError)
    def handle_opspilot_error(request: HttpRequest, exc: OpsPilotError):
        return api.create_response(
            request,
            error_envelope(
                code=exc.code,
                message=exc.message,
                request_id=request_id(request),
                field_errors=exc.field_errors,
                retryable=exc.retryable,
            ),
            status=exc.status,
        )

    @api.exception_handler(AuthenticationError)
    def handle_authentication_error(request: HttpRequest, exc: AuthenticationError):
        has_authorization = bool(request.headers.get("Authorization"))
        return api.create_response(
            request,
            error_envelope(
                code="INVALID_TOKEN" if has_authorization else "AUTH_REQUIRED",
                message=(
                    "The access token is invalid or expired."
                    if has_authorization
                    else "Sign in to access this resource."
                ),
                request_id=request_id(request),
            ),
            status=401,
        )

    @api.exception_handler(ValidationError)
    def handle_validation_error(request: HttpRequest, exc: ValidationError):
        return api.create_response(
            request,
            error_envelope(
                code="VALIDATION_ERROR",
                message="The request could not be validated.",
                request_id=request_id(request),
                field_errors=validation_field_errors(exc),
            ),
            status=422,
        )

    @api.exception_handler(Http404)
    def handle_not_found(request: HttpRequest, exc: Http404):
        return api.create_response(
            request,
            error_envelope(
                code="NOT_FOUND",
                message="The requested resource was not found.",
                request_id=request_id(request),
            ),
            status=404,
        )

    @api.exception_handler(Exception)
    def handle_unexpected_error(request: HttpRequest, exc: Exception):
        logger.exception("Unhandled API exception request_id=%s", request_id(request))
        return api.create_response(
            request,
            error_envelope(
                code="INTERNAL_ERROR",
                message="OpsPilot could not complete the request.",
                request_id=request_id(request),
            ),
            status=500,
        )
