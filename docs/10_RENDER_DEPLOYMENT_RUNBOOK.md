# 10 — Render Deployment Runbook

## Topology

Apply the repository-root `render.yaml` Blueprint to create:

- `opspilot-web`: Next.js web service
- `opspilot-api`: Django web service
- `opspilot-db`: managed PostgreSQL
- `opspilot-retention`: daily expired-run purge

The Blueprint uses production Starter web/cron services and a Basic PostgreSQL database. Plans can
be lowered for a disposable demo, but free database expiry and cold starts are not production-safe.

## Values Render will request

API service secrets:

```text
WORKOS_CLIENT_ID
GEMINI_API_KEY
OPENAI_API_KEY
FRONTEND_ORIGIN
DJANGO_ALLOWED_HOSTS
```

Frontend service secrets:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_SITE_URL
WORKOS_CLIENT_ID
WORKOS_API_KEY
NEXT_PUBLIC_WORKOS_REDIRECT_URI
```

Render generates the Django secret and WorkOS cookie password. Never paste provider or WorkOS API
keys into a `NEXT_PUBLIC_` variable.

## First-deploy URL sequence

After Render assigns service hostnames, use these values and redeploy both web services:

```text
NEXT_PUBLIC_API_BASE_URL=https://<opspilot-api-host>
NEXT_PUBLIC_SITE_URL=https://<opspilot-web-host>
FRONTEND_ORIGIN=https://<opspilot-web-host>
DJANGO_ALLOWED_HOSTS=<opspilot-api-host-without-scheme>
NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://<opspilot-web-host>/auth/callback
```

In the WorkOS dashboard, add this exact production redirect URI:

```text
https://<opspilot-web-host>/auth/callback
```

Keep the local development redirect URI as a separate entry:

```text
http://localhost:3000/auth/callback
```

## Release smoke

1. Confirm `GET https://<api-host>/api/v1/health` returns healthy.
2. Open the frontend, sign in with Google, and confirm the personal workspace loads.
3. Run one Efficient Gemini workflow and verify token usage and history.
4. Run one OpenAI workflow only if the optional key was configured.
5. Verify the same user's history, run detail, and manual run deletion.
6. Confirm another account cannot read the first account's run.
7. Check mobile and both themes, then sign out.

Do not promote a staging deployment until this entire journey passes.
