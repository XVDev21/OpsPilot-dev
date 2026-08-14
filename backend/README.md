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

Set the real `WORKOS_CLIENT_ID` in `backend/.env`. The API derives the WorkOS JWKS URL
from that client ID and does not need a WorkOS API key to validate access tokens.

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
- Gemini is intentionally absent from Backend Part 1.
