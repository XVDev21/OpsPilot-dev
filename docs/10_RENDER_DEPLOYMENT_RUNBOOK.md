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
WORKOS_API_KEY
WORKOS_ISSUER=<exact issuer for the WorkOS environment>
WORKOS_WEBHOOK_SECRET=<signing secret for the OpsPilot webhook endpoint>
GEMINI_API_KEY
AI_PLATFORM_PROVIDERS=gemini
FRONTEND_ORIGIN
DJANGO_ALLOWED_HOSTS
```

Render generates `DJANGO_SECRET_KEY` and `PROVIDER_CREDENTIAL_ENCRYPTION_KEYS`, then injects
`DATABASE_URL` from `opspilot-db`. Never reuse `DJANGO_SECRET_KEY` as the provider-credential key.
Discover the exact access-token `iss` value from WorkOS before setting Render:

```text
GET https://api.workos.com/user_management/<WORKOS_CLIENT_ID>/.well-known/openid-configuration
```

Copy the response's `issuer` field verbatim. WorkOS can return an issuer containing the environment's
default application client ID, which may differ from the visible `WORKOS_CLIENT_ID` used by this
application. Do not infer the issuer from the AuthKit sign-in hostname or normalize its path. OpenAI
and Qwen are personal-key integrations in this release and do not need platform secrets on Render.

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

## WorkOS collaboration webhook

After the backend containing workspace collaboration is deployed, create a WorkOS webhook endpoint:

```text
https://<opspilot-api-host>/api/v1/workos/events
```

Subscribe it to invitation and organization-membership lifecycle events, then copy that endpoint's
signing secret into Render as `WORKOS_WEBHOOK_SECRET`. The endpoint verifies `WorkOS-Signature`
against the untouched request body, records only idempotency metadata, rejects unsigned payloads,
and never stores invitation tokens or raw event bodies. Use **Sync directory** on the Team page as a
manual reconciliation path after an outage; webhooks remain the normal low-latency path.

The backend also requires `WORKOS_API_KEY` for organization provisioning, invitations, membership
deactivation, and reconciliation. This is separate from the frontend's server-only WorkOS API key
even when both deployments use the same WorkOS environment.

## Release smoke

1. Confirm `GET https://<api-host>/api/v1/health` returns healthy after any cold start.
2. Open the Vercel frontend, sign in with Google, and confirm the personal workspace loads.
3. Open Team, enable collaboration, and confirm the browser returns in the newly selected WorkOS
   Organization session.
4. Invite an alternate email, accept from a separate browser profile, and confirm the member can
   open published cases but cannot see another user's private drafts.
5. Change the invited member's role, replace one sample profile, and confirm earlier assignments
   remain attached to the same member history.
6. Run one Efficient Gemini workflow and verify token usage and history.
7. Run OpenAI only if the signed-in user connected a funded personal API key; it is not a release gate.
8. In Settings, save a disposable personal credential, confirm its masked fingerprint, run its
   provider, then delete the credential and confirm workspace fallback/unavailable status.
9. Run Qwen only after selecting the API-key region and, for Singapore or Beijing, its Model Studio
   workspace ID.
10. Verify history, credential source, run detail, manual run deletion, and cross-account isolation.
11. Check desktop, mobile, light, dark, system, and reduced-motion behavior.
12. Sign out and scan Vercel and Render logs for secret leakage or runtime errors.
