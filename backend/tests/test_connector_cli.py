import importlib.util
from pathlib import Path

import pytest

CONNECTOR_PATH = Path(__file__).parents[2] / "connector" / "opspilot_connector.py"
SPEC = importlib.util.spec_from_file_location("opspilot_connector", CONNECTOR_PATH)
assert SPEC and SPEC.loader
connector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(connector)


@pytest.mark.parametrize(
    "value",
    [
        "http://opspilot.example",
        "https://user:secret@opspilot.example",
        "https://opspilot.example?token=secret",
        "ftp://opspilot.example",
    ],
)
def test_connector_rejects_unsafe_opspilot_server_urls(value: str) -> None:
    with pytest.raises(ValueError):
        connector.validate_server_url(value)


def test_connector_allows_https_and_local_development_servers() -> None:
    assert connector.validate_server_url(" https://opspilot.example/ ") == (
        "https://opspilot.example"
    )
    assert connector.validate_server_url("http://127.0.0.1:8000/") == ("http://127.0.0.1:8000")


@pytest.mark.parametrize(
    "value",
    [
        "https://models.example/v1",
        "http://169.254.169.254/v1",
        "http://0.0.0.0:11434/v1",
        "http://127.0.0.1:11434/v1?key=secret",
    ],
)
def test_connector_rejects_non_local_or_ambiguous_model_urls(value: str) -> None:
    with pytest.raises(ValueError):
        connector.validate_local_base_url(value)


def test_connector_model_transport_disables_redirects() -> None:
    client = connector.build_model_client(
        api_key="local-model", base_url="http://127.0.0.1:11434/v1"
    )

    assert client._client.follow_redirects is False
    client.close()
