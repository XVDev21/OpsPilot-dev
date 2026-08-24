# OpsPilot API

Production-oriented Django and Django Ninja resource server for OpsPilot.

## Local setup (Windows PowerShell)

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver
```

Set the real `WORKOS_CLIENT_ID`, `GEMINI_API_KEY`, and
`PROVIDER_CREDENTIAL_ENCRYPTION_KEYS` in `backend/.env`. `OPENAI_API_KEY` and `QWEN_API_KEY` are
optional platform credentials because users can configure personal keys from Settings. Bedrock and
custom compatible endpoints are personal connections only. The API
derives the WorkOS JWKS URL from the client ID and does not need a WorkOS API key to validate access
tokens.

Case screenshots use local `backend/media` storage during development. Before relying on images in
production, configure the private S3-compatible `CASE_EVIDENCE_S3_*` variables documented in
`../docs/14_CASE_FIRST_ASSESSMENTS_AND_EVIDENCE.md`; Render Free's filesystem is not durable.

## Quality gates

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe manage.py makemigrations --check
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe -m pytest
```

## Service boundary

- Next.js owns sign-in, session cookies, and browser-facing BFF routes.
- Django accepts short-lived WorkOS access tokens as Bearer credentials.
- API routes use `/api/v1` and return a stable error envelope with request IDs.
- SQLite is local-only; production uses PostgreSQL through `DATABASE_URL`.
- Gemini is the default low-cost platform provider. OpenAI and Qwen are optional personal-key routes;
  `AI_PLATFORM_PROVIDERS` controls which shared credentials may be used.
- Bedrock uses a personal regional bearer key and exact tier mappings. Compatible custom providers
  require a public HTTPS endpoint; local/private servers use the outbound connector instead.
- Personal provider keys are encrypted at rest with a dedicated rotatable server secret, never
  returned by the API, and scoped to their authenticated owner.
- Qwen base URLs are constructed from an approved region and workspace ID; users cannot provide an
  arbitrary endpoint or model ID.
- Case assessments select only `fast`, `balanced`, or `high`; exact models come from server policy or a
  previously reviewed connection mapping, never a per-run model override.
- Local connector jobs are durable in PostgreSQL and schema-validated before completion; this
  personal preview does not require Redis or a separate worker.
- Trial workflow input and result history expires after 30 days by default.
- Case evidence and applied case history are durable account data and follow account deletion, not
  the 30-day workflow-run retention window.

## Retention

Expired runs are excluded from account history immediately. Purge them permanently with:

```powershell
.\.venv\Scripts\python.exe manage.py purge_expired_runs
```

The Render Blueprint schedules this command daily in production.
