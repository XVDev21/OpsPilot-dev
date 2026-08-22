"""Outbound OpsPilot connector for loopback/private OpenAI-compatible model servers."""

import argparse
import ipaddress
import json
import os
import time
from pathlib import Path
from urllib.parse import urlsplit

import httpx
import openai
from openai import DefaultHttpxClient, OpenAI

CONFIG_DIR = Path(os.getenv("LOCALAPPDATA") or Path.home() / ".config") / "OpsPilot"
CONFIG_PATH = CONFIG_DIR / "connector.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Pair and run an OpsPilot local model connector.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    pair_parser = subparsers.add_parser("pair", help="Redeem a one-time pairing code.")
    pair_parser.add_argument("--server", required=True)
    pair_parser.add_argument("--connector-id", required=True)
    pair_parser.add_argument("--pairing-code", required=True)
    pair_parser.add_argument("--base-url", default="http://127.0.0.1:11434/v1")
    pair_parser.add_argument("--api-key", default="local-model")
    run_parser = subparsers.add_parser("run", help="Poll and execute local model jobs.")
    run_parser.add_argument("--poll-seconds", type=float, default=2.0)
    args = parser.parse_args()
    if args.command == "pair":
        pair(args)
    else:
        run(args)


def pair(args) -> None:
    base_url = validate_local_base_url(args.base_url)
    server = validate_server_url(args.server)
    response = httpx.post(
        f"{server}/api/v1/connectors/pair",
        json={"connectorId": args.connector_id, "pairingCode": args.pairing_code},
        timeout=20,
        follow_redirects=False,
    )
    response.raise_for_status()
    payload = response.json()
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(
        json.dumps(
            {
                "server": server,
                "connectorId": payload["connectorId"],
                "connectorToken": payload["connectorToken"],
                "baseUrl": base_url,
                "apiKey": args.api_key,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    try:
        os.chmod(CONFIG_PATH, 0o600)
    except OSError:
        pass
    print(f"Paired. Connector configuration saved to {CONFIG_PATH}")


def run(args) -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    config["server"] = validate_server_url(config["server"])
    client = build_model_client(
        api_key=config["apiKey"],
        base_url=validate_local_base_url(config["baseUrl"]),
    )
    print("OpsPilot local connector is online. Press Ctrl+C to stop.")
    while True:
        try:
            job = claim_job(config)
            if job is None:
                time.sleep(max(0.5, args.poll_seconds))
                continue
            execute_job(config, client, job)
        except KeyboardInterrupt:
            print("Connector stopped.")
            return
        except (httpx.HTTPError, OSError, ValueError) as exc:
            print(f"Connector communication error: {type(exc).__name__}. Retrying.")
            time.sleep(max(2.0, args.poll_seconds))


def claim_job(config: dict) -> dict | None:
    response = httpx.post(
        f"{config['server']}/api/v1/connectors/{config['connectorId']}/claim",
        headers={"Authorization": f"Bearer {config['connectorToken']}"},
        timeout=20,
        follow_redirects=False,
    )
    if response.status_code == 204:
        return None
    response.raise_for_status()
    return response.json()


def execute_job(config: dict, client: OpenAI, job: dict) -> None:
    result: dict
    try:
        response = client.chat.completions.create(
            model=job["model"],
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"{job['systemInstruction']}\nReturn only one valid JSON object matching "
                        f"this JSON Schema: {job['outputSchema']}"
                    ),
                },
                {"role": "user", "content": job["userContent"]},
            ],
            response_format={"type": "json_object"},
            max_tokens=job["maxOutputTokens"],
            temperature=0,
        )
        content = response.choices[0].message.content if response.choices else None
        if not content:
            raise ValueError("Model returned no content")
        usage = response.usage
        result = {
            "output": json.loads(content),
            "inputTokens": getattr(usage, "prompt_tokens", None),
            "outputTokens": getattr(usage, "completion_tokens", None),
        }
    except (json.JSONDecodeError, ValueError):
        result = {"errorCode": "INVALID_AI_OUTPUT"}
    except openai.AuthenticationError:
        result = {"errorCode": "AI_AUTH_ERROR"}
    except openai.APITimeoutError:
        result = {"errorCode": "AI_TIMEOUT"}
    except (openai.APIConnectionError, openai.APIStatusError):
        result = {"errorCode": "AI_UNAVAILABLE"}
    response = httpx.post(
        (
            f"{config['server']}/api/v1/connectors/{config['connectorId']}"
            f"/jobs/{job['runId']}"
        ),
        headers={"Authorization": f"Bearer {config['connectorToken']}"},
        json=result,
        timeout=20,
        follow_redirects=False,
    )
    response.raise_for_status()
    print(f"Completed local workflow run {job['runId']}")


def validate_local_base_url(value: str) -> str:
    parsed = urlsplit(value.rstrip("/"))
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Local model URL must be an HTTP(S) endpoint without embedded credentials.")
    hostname = parsed.hostname.lower()
    if hostname == "localhost":
        return value.rstrip("/")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError as exc:
        raise ValueError("Use localhost or a literal private-network IP for the local model.") from exc
    is_safe_private = address.is_private and not (
        address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )
    if not (address.is_loopback or is_safe_private):
        raise ValueError("The local connector accepts only loopback or private-network model URLs.")
    return value.rstrip("/")


def validate_server_url(value: str) -> str:
    normalized = value.strip().rstrip("/")
    parsed = urlsplit(normalized)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("OpsPilot server URL must be a clean HTTP(S) origin without credentials.")
    hostname = parsed.hostname.lower()
    is_loopback = hostname == "localhost"
    if not is_loopback:
        try:
            is_loopback = ipaddress.ip_address(hostname).is_loopback
        except ValueError:
            pass
    if parsed.scheme != "https" and not is_loopback:
        raise ValueError("Use HTTPS for a non-local OpsPilot server.")
    return normalized


def build_model_client(*, api_key: str, base_url: str) -> OpenAI:
    return OpenAI(
        api_key=api_key,
        base_url=base_url,
        max_retries=0,
        http_client=DefaultHttpxClient(
            timeout=120,
            follow_redirects=False,
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=2),
        ),
    )


if __name__ == "__main__":
    main()
