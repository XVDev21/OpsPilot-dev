import ipaddress
import socket
from urllib.parse import urlsplit

from common.errors import OpsPilotError


def validate_public_https_base_url(value: str) -> str:
    normalized = value.strip().rstrip("/")
    try:
        parsed = urlsplit(normalized)
    except ValueError as exc:
        raise _invalid_endpoint() from exc
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or parsed.port not in {None, 443}
    ):
        raise _invalid_endpoint()
    try:
        addresses = {
            item[4][0] for item in socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
        }
    except (OSError, UnicodeError) as exc:
        raise _invalid_endpoint("The custom provider hostname could not be resolved.") from exc
    if not addresses or any(_blocked_address(address) for address in addresses):
        raise _invalid_endpoint()
    return normalized


def _blocked_address(value: str) -> bool:
    address = ipaddress.ip_address(value)
    return any(
        (
            address.is_private,
            address.is_loopback,
            address.is_link_local,
            address.is_multicast,
            address.is_reserved,
            address.is_unspecified,
        )
    )


def _invalid_endpoint(
    message: str = (
        "Use a public HTTPS provider endpoint without credentials, redirects, or a custom port."
    ),
) -> OpsPilotError:
    return OpsPilotError(
        code="VALIDATION_ERROR",
        message="Review the custom provider endpoint.",
        status=422,
        field_errors={"baseUrl": [message]},
    )
