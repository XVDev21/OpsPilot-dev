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
→ provider-neutral AI adapter (Gemini default, OpenAI compatible)
```

Trust boundaries:

- WorkOS owns authentication and session issuance.
- Next.js owns session cookies and obtains access tokens only on the server.
- Django verifies every Bearer token and owns authorization, persistence, and workflow policy.
- The selected AI provider receives only validated, bounded workflow input through a backend-only adapter.
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

- Keep trial workflow inputs and results for 30 days, then purge them permanently.
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

## Product decisions resolved for the first production release

1. Personal-only data ownership; organization workspaces are deferred.
2. Workflow input/result history expires after 30 days during the trial.
3. Vercel Hobby hosts Next.js; Render Free hosts Django and PostgreSQL in Singapore. The paid
   retention cron is deferred while expired runs remain hidden by API policy and are purged on deploy.
4. Provider/model policy is server-owned and uses pinned stable model IDs.
5. Gemini Efficient is the default low-cost/low-latency route; Balanced and Deep are optional.
6. OpenAI remains an optional personal-key provider using the same workflow contracts; Gemini is
   the only platform-funded provider for the current hobby release.
7. Initial live limits are five runs per minute and 30 per rolling day per account.

## Initiative 8 — Collaboration and assignment integrity

- Keep the first release personal-first while representing delivery handoffs with explicitly
  fictional sample profiles and non-routable `example.invalid` addresses.
- Treat sample selections as workflow context only; they do not create identities, grant access,
  send notifications, or imply that work was assigned.
- Distinguish configuration/process reports from evidence-backed product defects before suggesting
  engineering work.
- Preserve only user-selected collaborator identifiers; providers must never invent an owner,
  coordinator, author, member, or role.
- Introduce real collaboration later behind an organization-scoped membership model with WorkOS
  organization identity, invitation states, least-privilege roles, auditable assignments, and
  per-workspace data isolation.

Gate: all three workflows remain useful in Simple Mode, Advanced ownership is contract-validated,
fictional fixtures are unmistakable, and no sample action produces a real authorization side effect.

## Next initiatives after Backend Part 2

1. Complete the signed-in browser path from WorkOS through the Next.js BFF to Django and Gemini,
   recording latency, token usage, and result-schema validity for golden inputs.
2. Deploy the Vercel frontend and Render backend Blueprint, bind final service origins, register the
   production WorkOS callback, and run the release journey before promoting production.
3. Add privacy self-service for full account export and account erasure before paid launch.
4. Add structured request/provider telemetry and alerting without logging workflow input or secrets.
5. Establish per-tier budget envelopes and user-visible monthly usage before billing is introduced.
6. Add a durable queue only if measured synchronous timeout or concurrency data requires it.
