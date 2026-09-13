# OpsPilot project and PR review — September 13, 2026

## Assessment

OpsPilot is an existing deployed case-management product with AI-assisted assessment. The latest
feature milestone is PR #39 (durable notifications), following cases (#25), private evidence and
assessments (#26), delivery collaboration (#27), and WorkOS participation (#28). Preserve this
architecture and history. Further scaffolding or a framework rewrite is unwarranted.

The product loop is: capture a case and evidence → request an assessment → review/apply → publish
and assign → record work → verify resolution. AI proposes; authenticated humans make consequential
decisions. Demo workflows remain deterministic and independent of backend availability.

## Architecture that is already working

- Vercel: Next.js App Router, React, TypeScript, Zod, React Hook Form, TanStack Query, and AuthKit.
- Next.js server routes own sessions and forward WorkOS bearer tokens to Django. Tokens are not
  persisted in browser storage. Public Demo execution is local and schema validated.
- Render: Django 5.2/Ninja, services and selectors outside routes, explicit schemas, PostgreSQL,
  WorkOS signature/claim validation, workspace roles, private evidence and versioned assessments.
- Provider adapters cover Gemini, OpenAI, Qwen, Bedrock, compatible endpoints, and a local outbound
  connector. Credential encryption and human-controlled publication are valuable existing boundaries.
- Domain events feed recipient-specific notifications and a Resend outbox with idempotency,
  send-time policy checks, retry leases, and signed webhook reconciliation.

## Findings and priorities

### Urgent: preserve the production database

Render's authenticated dashboard reports `opspilot-db` (PostgreSQL 18, Singapore) as Available on
Free, with an explicit September 13, 2026 expiration date. Approximately 6.9% of 1 GB is used.
This is observed live, not just copied from old documentation. The lowest displayed paid compute
option is $6/month; check the complete billing terms and storage charges before approving an upgrade.
No billing, database, networking, or credential settings were changed during this review.

Render documents that Free databases expire after 30 days, become inaccessible at expiration, and
have a 14-day upgrade grace period before deletion. They have no backups. Arrange an upgrade or
an explicitly approved migration and backup immediately; do not delete or recreate the existing DB.
Sources: https://render.com/docs/free and the authenticated database dashboard.

### High: production release evidence is incomplete

Production Google login succeeded and the personal workspace, existing case register, and Work
Status loaded through Vercel/Django. That demonstrates the authenticated database read path.
The public API initially timed out at 45 seconds, then returned HTTP 200 after cold start.

This review did not send invitations or email, create/publish production cases, run paid/provider
requests, or exercise another user's account. Multi-user isolation, actual private object-storage
persistence across redeploys, full assessment-to-verification flow, and real webhook/email delivery
remain explicit release gates. Existing unit tests are useful but do not replace those checks.

### High: CI does not test PostgreSQL semantics or enforce the merge policy

`.github/workflows/ci.yml` runs frontend checks and backend checks on Windows and Linux. However,
`backend/config/settings/test.py` unconditionally selects in-memory SQLite. Supplying a PostgreSQL
URL to the job does not change that. Workspace, quota, webhook, and delivery code uses row locks
and, in places, `skip_locked`; add a PostgreSQL integration job with concurrency regressions.

The GitHub branch-protection endpoint reports that `main` is not protected. Before production
expansion, make required checks and review rules enforceable rather than relying on convention.

### Medium: health and timeout behavior need operational verification

`backend/common/api.py` returns a fixed health payload with no database query. Keep that as a
liveness check and introduce separate database readiness/monitoring. A green health check alone
cannot detect expired PostgreSQL. `frontend/lib/api/client.ts` times out JSON requests after 30
seconds; the observed cold start exceeded that. Validate recovery and preserved input under a
sleeping service and slow model execution before committing to an always-on hosting budget.

### Medium: product copy and historical docs have drifted

The authenticated overview in `frontend/app/app/page.tsx` still presents “PR 3 · Work Status
collaboration” as the next phase and says email is not added yet. Both are shipped. The landing page
still primarily explains the original workflow catalog. A bounded copy/navigation pass should
present the case lifecycle and existing Work Status/notification capabilities coherently.

The startup documents incorrectly directed agents to scaffold a blank repository. This maintenance
change corrects `START_HERE.md`, `CODEX_START_NOW_PROMPT.md`, and the current status heading. Older
milestone sections remain historical records; their old deferrals and test counts are not current
feature inventories. No UI redesign is included in this maintenance release.

## PR decisions

All ten open PRs are compatible dependency updates with passing existing frontend, Windows/Linux
backend, and Vercel preview checks. No proposed feature is obsolete or should be discarded.
Preserve their original commits in one integration PR so overlapping pins are resolved once,
Next.js and its ESLint configuration land together, and combined CI validates the actual release.
Use a merge commit rather than squash so GitHub can recognize the original PR heads in `main`.

| PR | Intent | Review decision |
| --- | --- | --- |
| #40 | cryptography 50.0.0 → 50.0.1 | Include; JWT/credential regressions pass |
| #41 | django-ninja 1.6.3 → 1.7.0 | Include; schema, auth, multipart and OpenAPI tests pass |
| #42 | google-genai 2.18.1 → 2.21.0 | Include; adapter and validated-output tests pass |
| #43 | resend 2.40.2 → 2.42.0 | Include; 18 notification regressions pass |
| #44 | next 16.3.1 → 16.3.4 | Include with #49; verify production build and browser |
| #45 | boto3 1.43.82 → 1.43.85 | Include; preserve #40 in overlapping requirements lines |
| #46 | react-hook-form 7.85.0 → 7.87.0 | Include; form/workflow/component tests pass |
| #47 | react-query 5.101.4 → 5.102.8 | Include; query-dependent tests pass |
| #48 | React DOM types 19.2.4 → 19.2.5 | Include; typecheck passes |
| #49 | eslint-config-next 16.3.1 → 16.3.4 | Include with #44; lint passes |

Fresh npm audit found three development-dependency entries involving Vitest/mocker and js-yaml.
Patch Vitest to 4.1.11 and js-yaml to 4.3.2; the resulting npm audit reports zero vulnerabilities.
These were existing tooling dependencies, not evidence of a production exploit. The local Python
audit also flagged the bundled pip installer; update that isolated virtual environment's pip.

Official references reviewed include Next.js 16.3.4, Django Ninja 1.7.0, Gemini SDK 2.21.0,
Resend 2.42.0 and React Hook Form 7.87.0 release notes, plus:
- https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9
- https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh

## Delivery approach

1. Preserve database continuity and establish a backup/restore plan.
2. Land the reviewed dependency set and confirm both independent production deployments.
3. Add PostgreSQL CI and enforce required checks; track readiness separately from liveness.
4. Verify the complete authenticated case lifecycle with two designated test accounts, private
   storage and controlled provider/email tests. Keep production side effects explicitly authorized.
5. Correct the overview and public product story to reflect the shipped case workflow.
6. Add one external connector only after these gates pass, consuming the existing event/outbox
   boundary. Avoid broad provider expansion or an infrastructure rewrite without measured need.

The immediate aim is a dependable, demonstrable case lifecycle with clear ownership and evidence.
Paid workers, scheduled delivery guarantees, billing, and additional connectors are separate phases.
