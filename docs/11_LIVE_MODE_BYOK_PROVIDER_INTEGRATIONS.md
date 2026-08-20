# 11 — Live Mode and Personal Provider Integrations

## Delivered scope

Authenticated Live Mode supports the three approved OpsPilot workflows through a vetted provider
catalog:

- Gemini — default Efficient route
- OpenAI — optional personal-key route that requires a funded OpenAI API project
- Qwen — optional personal Alibaba Cloud Model Studio route

Each provider maps Efficient, Balanced, and Deep to exact models owned by backend configuration.
The browser cannot submit a model ID, base URL, hidden instruction, or unbounded workflow payload.
Demo Mode remains deterministic and never makes a provider request.

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
PUT    /api/v1/provider-credentials/{gemini|openai|qwen}
DELETE /api/v1/provider-credentials/{gemini|openai|qwen}
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

## Deployment checklist

1. Apply migrations for `provider_credentials` and `workflow_runs.credential_source`.
2. Set a new `PROVIDER_CREDENTIAL_ENCRYPTION_KEYS` secret on Render before deploying the API.
3. Keep `GEMINI_API_KEY` as the default platform fallback and set
   `AI_PLATFORM_PROVIDERS=gemini`. Do not add platform OpenAI/Qwen keys for this release.
4. Deploy the backend before the frontend so the new credential/status contracts are available.
5. Sign in, open Settings, add a disposable personal key, verify only its fingerprint is shown, run
   the provider, and confirm the run reports `Personal key`.
6. Delete the disposable key and confirm the provider falls back to `Workspace key` or becomes
   unavailable.
7. Inspect Render/Vercel logs for raw keys, tokens, prompts, or provider payloads; none should appear.

## Intentional non-goals

- arbitrary OpenAI-compatible endpoints
- arbitrary model IDs or hidden prompts
- organization-shared credential vaults
- provider billing or prepaid token wallets
- asynchronous queues for the current bounded hobby workload

Adding another provider requires a backend adapter, a server-owned model map, safe error
normalization, catalog metadata, contract fixtures, and adapter/security tests. It is not a data-only
user configuration change.
