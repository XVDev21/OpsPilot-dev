# 04 — Backend Part 1: Django Foundation and Authenticated Persistence

## Objective

Create the production-oriented Python backend foundation after the frontend is approved.

## Stack

- Python
- Django 5.2 LTS
- Django Ninja
- django-cors-headers
- JWT/JWKS verification dependencies appropriate for current WorkOS guidance
- pytest
- pytest-django
- SQLite local
- PostgreSQL production
- Ruff and coverage gates

## Windows local setup

From repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install --upgrade pip
pip install -r requirements.txt
```

No WSL requirement.

## Structure

```text
backend/
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── local.py
│   │   └── production.py
│   ├── urls.py
│   └── asgi.py
├── common/
│   ├── auth.py
│   ├── errors.py
│   └── request_id.py
├── accounts/
├── workflows/
├── runs/
├── ai/
├── tests/
├── manage.py
├── requirements.txt
└── .env.example
```

## Environment

```text
DJANGO_SECRET_KEY
DJANGO_DEBUG
DJANGO_ALLOWED_HOSTS
DATABASE_URL
FRONTEND_ORIGIN

WORKOS_CLIENT_ID
WORKOS_ISSUER
WORKOS_JWKS_URL
WORKOS_JWKS_CACHE_SECONDS
```

`WORKOS_JWKS_URL` may be omitted locally and derived as
`https://api.workos.com/sso/jwks/<WORKOS_CLIENT_ID>`. Django does not need the WorkOS API key to
validate an AuthKit access token. Gemini configuration begins in Backend Part 2.

## Production settings

Require:

- `DEBUG=False`
- explicit allowed hosts
- explicit CORS
- secure proxy/HTTPS awareness where required
- secrets only through environment configuration
- no wildcard authenticated CORS

## WorkOS JWT

Django is a resource server.

For each protected API request:

1. parse Bearer token
2. retrieve/cache official WorkOS JWKS
3. verify signature
4. verify expiration
5. verify issuer
6. require and compare the WorkOS `client_id` claim to `WORKOS_CLIENT_ID`
7. extract `sub`
8. map to local user
9. attach user to request context

Do not trust arbitrary browser-supplied user IDs.

## AppUser

Fields:

```text
id UUID
workos_user_id unique
email nullable/cache
display_name nullable/cache
avatar_url nullable/cache
created_at
updated_at
last_seen_at
```

The WorkOS user ID is the authoritative external identity.

## WorkflowRun

Fields:

```text
id UUID
user FK
workflow_id
status
input_json
result_json nullable
error_code nullable
provider nullable
model nullable
duration_ms nullable
created_at
completed_at nullable
```

Status:

```text
pending
completed
failed
```

Index by user and created_at.

## Canonical workflow registry

Backend owns the workflow definitions and hidden prompt behavior.

```python
WORKFLOW_REGISTRY = {
    "bug-triage": ...,
    "meeting-actions": ...,
    "status-update": ...,
}
```

Each contains:

- ID
- metadata
- input schema
- output schema
- prompt compiler
- provider policy

Browser cannot supply arbitrary system prompts.

## API Part 1

```text
GET /api/v1/health
GET /api/v1/me
GET /api/v1/workflows
GET /api/v1/runs
GET /api/v1/runs/{run_id}
DELETE /api/v1/runs/{run_id}
```

Health public.

User/domain routes authenticated.

## Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be validated.",
    "fieldErrors": {},
    "requestId": "uuid",
    "retryable": false
  }
}
```

No production raw exception messages.

## History

Simple page pagination:

- newest first
- 20 per page
- current authenticated user only

## CORS

Local allowed origin:

```text
http://localhost:3000
```

Production:

explicit deployed frontend origin.

## Tests

Required:

- health
- no token
- invalid token
- valid WorkOS token fixture/path
- local user mapping
- user cannot access another user's run
- workflow metadata
- history serialization
- delete ownership
- error envelope
- shared frontend/backend contract fixtures
- OpenAPI Bearer security definition

## Engineering gates

```powershell
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe manage.py makemigrations --check
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe -m pytest
```

CI runs the backend suite on Windows and Linux. Production must also pass Django's deployment checks.

## Completion

- Windows Django setup works
- migrations work
- authentication works
- persistence works
- history API works
- tests pass
- API contract matches frontend
