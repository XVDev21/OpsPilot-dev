# 09 — Delivery Initiatives and Release Gates

## Purpose

Extend the phase plans with the system-level work required to operate OpsPilot safely and
predictably after the hackathon. These initiatives strengthen the existing architecture; they do not
replace the Backend Part 1 → Backend Part 2 → deployment sequence.

## System design baseline

OpsPilot is a modular monolith with two independently deployable services:

```text
Browser
→ Next.js application and BFF routes
→ versioned Django Ninja API
→ application services and domain models
→ PostgreSQL
→ AI provider adapter (Backend Part 2)
```

Trust boundaries:

- WorkOS owns authentication and session issuance.
- Next.js owns session cookies and obtains access tokens only on the server.
- Django verifies every Bearer token and owns authorization, persistence, and workflow policy.
- Gemini receives only validated, bounded workflow input through a backend-only adapter.
- PostgreSQL is the source of truth for user-owned workflow runs.

Do not split this into microservices until measured scaling or team-ownership pressure justifies the
operational cost.

## Initiative 1 — Contract governance

- Store canonical API examples in `contracts/v1/`.
- Validate the same fixtures with frontend Zod and backend Pydantic schemas.
- Snapshot Django Ninja OpenAPI and review breaking changes.
- Introduce generated TypeScript types only after the v1 contract stabilizes.
- Version breaking changes under a new API prefix rather than silently changing v1.

Gate: frontend and backend contract suites pass from the same fixture corpus.

## Initiative 2 — Identity and authorization assurance

- Allow only `RS256` WorkOS tokens signed by the client-specific JWKS.
- Require `iss`, `sub`, `client_id`, `iat`, and `exp` and compare `client_id` to configuration.
- Cache JWKS with bounded network timeouts and safe rotation behavior.
- Scope every run query and mutation to the authenticated local user.
- Keep organization claims available for a later workspace model without granting access from them yet.

Gate: positive and negative JWT tests plus cross-user ownership tests pass.

## Initiative 3 — Reliability and observability

- Correlate `X-Request-ID` through Next.js, Django, logs, and provider calls.
- Record run lifecycle, prompt version, provider, model, duration, and safe failure code.
- Provide separate liveness and database/provider readiness checks before production.
- Use structured logs with secret and user-input redaction.
- Establish latency and error-rate objectives before adding infrastructure.

Gate: a failed request can be traced by request ID without exposing a token or workflow input.

## Initiative 4 — AI quality engineering

- Maintain golden inputs and expected invariants for all three workflows.
- Evaluate fabrication, missing-owner/deadline handling, schema validity, and human-review messaging.
- Pin an explicit stable model; do not use a floating `latest` alias in production.
- Allow at most one controlled repair attempt for malformed provider output.
- Keep deterministic Demo Mode as the zero-provider fallback.

Gate: mocked CI evaluation passes and a manual real-provider smoke test is recorded before release.

## Initiative 5 — Privacy, abuse, and cost controls

- Define retention for workflow inputs and results before production.
- Enforce per-field and total request-size limits.
- Add authenticated per-user throttling before enabling live Gemini broadly.
- Never log raw access tokens, provider keys, hidden prompts, or complete user input.
- Support user deletion now; add export and scheduled retention deletion when policy is chosen.

Gate: retention, deletion, throttling, and secret-rotation runbooks are documented.

## Initiative 6 — CI/CD and supply chain

- Run frontend gates and backend Linux/Windows gates on every pull request.
- Require migration consistency, Ruff, tests, coverage, and Django deployment checks.
- Run scheduled npm, pip, and GitHub Actions dependency updates.
- Add secret scanning, dependency vulnerability review, and protected-branch checks before production.
- Keep migrations forward-compatible and document rollback or roll-forward procedures.

Gate: protected `main` accepts only reviewed changes with green required checks.

## Initiative 7 — Production operations

- Deploy Next.js and Django independently with explicit origins and HTTPS.
- Use managed PostgreSQL with backups and a tested restore procedure.
- Separate preview, staging, and production environments and credentials.
- Document WorkOS callback/sign-out URI changes for each environment.
- Document deploy, migrate, smoke-test, rollback, incident, and key-rotation procedures.

Gate: staging passes the complete sign-in → workflow → history → deletion → sign-out journey.

## Product decisions to settle

1. Personal-only data ownership versus WorkOS organization workspaces.
2. Workflow input/result retention period.
3. Render-only topology versus Vercel frontend plus Render API/PostgreSQL.
4. Production domain and deployment region.
5. Acceptable Gemini cost, latency, and per-user request limits.

Current implementation defaults to personal ownership, user-managed deletion, Render topology, and
conservative synchronous execution until these decisions are finalized.
