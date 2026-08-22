# 11 — Live Mode and Personal Provider Integrations

## Delivered scope

Authenticated Live Mode supports the three approved OpsPilot workflows through a vetted provider
catalog:

- Gemini — default Efficient route
- OpenAI — optional personal-key route that requires a funded OpenAI API project
- Qwen — optional personal Alibaba Cloud Model Studio route
- Amazon Bedrock — personal bearer API key, AWS Region, and explicit tier models
- OpenAI-compatible — named public HTTPS endpoint plus explicit tier models
- Local connector — an outbound bridge to a private Ollama, LM Studio, or vLLM-compatible server

Core providers map Efficient, Balanced, and Deep to exact models owned by backend configuration.
Bedrock, compatible endpoints, and local connectors require the user to map all three tiers before
use. The browser still cannot submit a per-run model ID, hidden instruction, or unbounded workflow
payload. Demo Mode remains deterministic and never makes a provider request.

## Credential precedence

For a selected provider, Django resolves credentials in this order:

1. the authenticated user's personal credential
2. an allowlisted platform credential configured in the backend environment
3. an unavailable-provider error when neither exists

`AI_PLATFORM_PROVIDERS` is the server-owned spending boundary. The current production value is
`gemini`, so a leftover OpenAI or Qwen environment key cannot silently fund a run. Personal
credentials remain usable regardless of this platform allowlist.

The resolved source (`personal` or `platform`) is saved on the workflow run for user-visible
diagnostics. No API response includes the provider key.

## Personal credential security

`PUT /api/v1/provider-credentials/{provider}` encrypts the submitted key before PostgreSQL storage.
The key is decrypted only inside the authenticated provider-resolution boundary for a Live Mode run.
The status API returns a short SHA-256 fingerprint, configuration metadata, and timestamps—not the
key or ciphertext.

Encryption uses `PROVIDER_CREDENTIAL_ENCRYPTION_KEYS`, a comma-separated key ring:

```text
PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=<new-primary>,<previous-key>
```

The first secret encrypts new or rotated credentials. Remaining secrets decrypt existing rows during
an operational rotation. Each secret must contain at least 32 high-entropy characters. To complete a
rotation, keep the old key available until users have rotated their provider credentials or an
explicit re-encryption migration has been shipped. Losing every decrypting key makes existing
credentials unrecoverable by design.

Credential endpoints are ownership-scoped and require a verified WorkOS Bearer token:

```text
GET    /api/v1/provider-credentials
PUT    /api/v1/provider-credentials/{gemini|openai|qwen|bedrock|custom}
DELETE /api/v1/provider-credentials/{gemini|openai|qwen|bedrock|custom}
```

## Qwen endpoint policy

Qwen API keys are region-specific. Settings captures an approved region and, where required, the
Model Studio workspace ID. Django constructs one of these endpoint forms:

```text
Singapore     https://<workspace>.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1
US Virginia   https://dashscope-us.aliyuncs.com/compatible-mode/v1
Beijing       https://<workspace>.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
```

Workspace IDs must match a strict hostname-label pattern. Arbitrary URLs are never accepted. The
Qwen adapter requests JSON mode, disables thinking for predictable structured output/cost, and
passes the server-owned intelligence-tier budget as `max_completion_tokens`. Every result is
validated against the same workflow Pydantic contract used by the other adapters.

## Bedrock and compatible endpoint policy

Bedrock calls the regional Runtime `Converse` endpoint with `Authorization: Bearer <key>`. The
credential needs `bedrock:InvokeModel` access to every mapped model in the selected AWS Region.
Use short-term Bedrock API keys for production operation and rotate them independently of the
OpsPilot encryption key ring.

A custom connection accepts a display name, API key, public HTTPS base URL, and exact Efficient,
Balanced, and Deep model IDs. Django resolves the hostname before saving and before use, rejecting
private, loopback, link-local, multicast, reserved, or unspecified addresses, embedded credentials,
query/fragment tricks, redirects, and custom ports. This is a governed OpenAI-compatible contract,
not arbitrary server-side HTTP: prompts remain OpsPilot-owned and results remain schema-validated.

Because DNS can change between validation and connection, production infrastructure should also
enforce an outbound allowlist or egress proxy for compatible endpoints.

## Local connector boundary

The local connector is separate from the encrypted provider vault. Settings creates a ten-minute,
one-time pairing code. Redemption returns a connector token once; Django stores only its SHA-256
digest. The connector polls the public OpsPilot API over outbound HTTPS, then calls a loopback or
literal private-network OpenAI-compatible endpoint from the user's machine. No inbound firewall
rule or public model-server port is required.

Connector job state is durable in PostgreSQL with leases and bounded attempts. Outputs are validated
by the same workflow schema before a run completes. The preview connector stores its token and local
model API key in the current OS user's application-data directory with restrictive file permissions
where supported; a paid multi-user desktop release should move these secrets to the OS keychain.

## Deployment checklist

1. Apply migrations for provider metadata, local connectors/jobs, execution phases, handoffs, and
   work items.
2. Set a new `PROVIDER_CREDENTIAL_ENCRYPTION_KEYS` secret on Render before deploying the API.
3. Keep `GEMINI_API_KEY` as the default platform fallback and set
   `AI_PLATFORM_PROVIDERS=gemini`. Do not add platform OpenAI/Qwen keys for this release.
4. Deploy the backend before the frontend so the new credential/status contracts are available.
5. Sign in, open Settings, add a disposable personal key, verify only its fingerprint is shown, run
   the provider, and confirm the run reports `Personal key`.
6. Delete the disposable key and confirm the provider falls back to `Workspace key` or becomes
   unavailable.
7. Inspect Render/Vercel logs for raw keys, tokens, prompts, or provider payloads; none should appear.
8. For Bedrock, test each tier in the chosen Region with a short-term key and least-privilege
   `bedrock:InvokeModel` access. For local models, pair and start the connector on the user's host.

## Intentional non-goals

- unauthenticated HTTP or private-network custom endpoints reached directly from Django
- per-run arbitrary model IDs or user-supplied hidden prompts
- organization-shared credential vaults
- provider billing or prepaid token wallets
- general-purpose remote agents or arbitrary tool execution

Adding another provider requires a backend adapter, a server-owned model map, safe error
normalization, catalog metadata, contract fixtures, and adapter/security tests. It is not a data-only
user configuration change.
