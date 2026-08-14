from collections.abc import Callable
from uuid import UUID, uuid4

from django.http import HttpRequest, HttpResponse

REQUEST_ID_HEADER = "X-Request-ID"


def normalize_request_id(value: str | None) -> str:
    if value:
        try:
            return str(UUID(value))
        except ValueError, AttributeError:
            pass
    return str(uuid4())


class RequestIdMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        request.request_id = normalize_request_id(request.headers.get(REQUEST_ID_HEADER))
        response = self.get_response(request)
        response.headers[REQUEST_ID_HEADER] = request.request_id
        return response
