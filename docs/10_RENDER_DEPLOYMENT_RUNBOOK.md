# 10 — Vercel + Render Free Deployment Runbook

## Approved hobby topology

- `opspilot-web`: Vercel Hobby Next.js project rooted at `frontend/`
- `opspilot-api`: Render Free Django web service in Singapore
- `opspilot-db`: Render Free PostgreSQL database in Singapore

The repository-root `render.yaml` is the canonical backend Blueprint. It deliberately does not create
a Render frontend, Key Value instance, worker, or cron service.

## Free-tier constraints

- The API spins down after 15 idle minutes and can take approximately one minute to wake.
- Free PostgreSQL expires after 30 days, has no backups, and allows only one free database per Render
  workspace.
- Render cron services and pre-deploy commands require paid instances.
- Migrations and expired-run purging therefore run in the backend build command. API selectors hide
  expired runs immediately, but strict scheduled physical deletion requires a paid retention cron.

This topology is appropriate only for the approved personal, non-commercial hobby deployment. Before
launching commercially, move the API and database to paid instances and restore a daily retention cron.

## Values Render requests

API service secrets:

```text
WORKOS_CLIENT_ID
WORKOS_ISSUER=https://api.workos.com/
GEMINI_API_KEY
AI_PLATFORM_PROVIDERS=gemini
FRONTEND_ORIGIN
DJANGO_ALLOWED_HOSTS
```

Render generates `DJANGO_SECRET_KEY` and `PROVIDER_CREDENTIAL_ENCRYPTION_KEYS`, then injects
`DATABASE_URL` from `opspilot-db`. Never reuse `DJANGO_SECRET_KEY` as the provider-credential key.
Keep the trailing slash in `WORKOS_ISSUER`; JWT issuer comparison is intentionally exact. OpenAI and
Qwen are personal-key integrations in this release and do not need platform secrets on Render.

## Values Vercel requires

Production environment:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_SITE_URL
WORKOS_CLIENT_ID
WORKOS_API_KEY
WORKOS_COOKIE_PASSWORD
NEXT_PUBLIC_WORKOS_REDIRECT_URI
```

Only `NEXT_PUBLIC_*` values are exposed to the browser. Provider keys remain backend-only, and WorkOS
server secrets remain server-only.

## First-deploy URL sequence

After both platforms assign hostnames, set and redeploy with:

```text
NEXT_PUBLIC_API_BASE_URL=https://<opspilot-api-host>
NEXT_PUBLIC_SITE_URL=https://<opspilot-vercel-host>
FRONTEND_ORIGIN=https://<opspilot-vercel-host>
DJANGO_ALLOWED_HOSTS=<opspilot-api-host-without-scheme>
NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://<opspilot-vercel-host>/auth/callback
```

Register these production WorkOS URLs:

```text
Redirect URI: https://<opspilot-vercel-host>/auth/callback
Sign-in endpoint: https://<opspilot-vercel-host>/sign-in
Logout URI: https://<opspilot-vercel-host>/
```

Keep `http://localhost:3000/auth/callback` as a separate local redirect URI.

## Release smoke

1. Confirm `GET https://<api-host>/api/v1/health` returns healthy after any cold start.
2. Open the Vercel frontend, sign in with Google, and confirm the personal workspace loads.
3. Run one Efficient Gemini workflow and verify token usage and history.
4. Run OpenAI only if the signed-in user connected a funded personal API key; it is not a release gate.
5. In Settings, save a disposable personal credential, confirm its masked fingerprint, run its
   provider, then delete the credential and confirm workspace fallback/unavailable status.
6. Run Qwen only after selecting the API-key region and, for Singapore or Beijing, its Model Studio
   workspace ID.
7. Verify history, credential source, run detail, manual run deletion, and cross-account isolation.
8. Check desktop, mobile, light, dark, system, and reduced-motion behavior.
9. Sign out and scan Vercel and Render logs for secret leakage or runtime errors.
