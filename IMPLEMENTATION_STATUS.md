# OpsPilot AI - Implementation Status

**Environment:** Windows / PowerShell
**Project type:** Greenfield monorepo
**Current milestone:** Case-first assessments + private evidence
**Status:** Implementation complete; release gates passed; draft PR ready

## Milestones

- [x] Greenfield bootstrap
- [x] Frontend Part 1 - visible product core
- [x] Frontend Part 2 - WorkOS + live API frontend
- [x] Backend Part 1 - Django foundation
- [x] Backend Part 2 - provider-neutral workflow engine
- [x] Live Mode - encrypted personal Gemini/OpenAI/Qwen integrations
- [x] Simple/Advanced workflow intake + fictional sample delivery pod
- [x] Observable execution phases and real elapsed-time feedback
- [x] Personal Bedrock, governed compatible API, and outbound local-model connections
- [x] Human-reviewed Bug Triage handoffs and personal Work Items
- [x] Operations Cases, durable personal workspaces, and real member assignments
- [x] Case-first intake, private multimodal evidence, and confidence-based assessments
- [ ] End-to-end integration
- [x] Deployment

## Case-first assessments and private evidence

- [x] make authenticated Operations Cases the only new-work entry point while retaining the
  workflow engine as an internal compatibility and execution boundary
- [x] add issue, clarification, and enhancement intent plus independent draft, published, and
  archived publication states
- [x] support private text and JPEG/PNG/WebP evidence with authenticated streaming, metadata
  stripping, digesting, and explicit deletion
- [x] add append-only, versioned Case Assessments with provider/model/prompt provenance and an
  immutable evidence snapshot reserved before execution
- [x] derive OpsPilot decision confidence from model confidence, evidence coverage, gaps, and
  contradictions without allowing AI to publish, assign, resolve, or close a case
- [x] present proposed disposition, confidence factors, facts, missing or contradicting evidence,
  settings guidance, verification, routing, and human-review requirements
- [x] allow explicit human application of an assessment to the case working summary and disposition
- [x] show configured provider/model choices per case and preserve every model switch as a separate
  assessment rather than silently blending results
- [x] preserve public deterministic Demo workflows and redirect authenticated workflow navigation
  into Cases
- [x] bound multipart parsing, image dimensions, normalized size, per-workspace storage, and
  per-assessment image materialization at both the Next.js and Django boundaries
- [x] document private S3-compatible production storage and lock the PR 3 Work Status collaboration
  contract

```text
backend Ruff            PASS - format and lint
migration consistency   PASS - no model changes missing migrations
Django checks           PASS - local and production deployment checks
backend dependencies    PASS - pip check found no broken requirements
backend tests           PASS - 119 tests, 91.23% branch coverage
frontend lint           PASS - zero warnings
frontend typecheck      PASS
frontend tests          PASS - 18 files, 49 tests
frontend build          PASS - Next.js 16.3.1, 33 generated pages
browser verification    PASS - 1280 desktop light/system-dark and 390x844 responsive mobile,
                          meaningful content, zero overflow, and no framework error overlay;
                          authenticated case components/BFF routes covered by tests because this
                          clean worktree has no local WorkOS callback/session configuration
security diff scan      PASS AFTER HARDENING - complete changed-file coverage; assessment
                          provenance, pre-auth multipart parsing, storage quotas, immutable local
                          snapshots, and bounded image materialization remediated and tested
```

## Operations Cases and durable assignments

- [x] provision one personal workspace for every existing and new account
- [x] persist the five clearly identified sample collaborators as workspace-owned member records
- [x] replace free-form Work Item assignee strings with validated member relationships while
  preserving known and unknown legacy assignment keys
- [x] add workspace-scoped Operations Cases, current assignments, and append-only Case Events
- [x] attach workflow runs, handoffs, and Work Items to cases through nullable relationships so
  standalone workflow compatibility remains intact
- [x] add paginated case APIs with search, state, disposition, and assignee filters
- [x] enforce workspace authorization and server-owned case-state transitions
- [x] add the responsive case register, case detail control plane, delivery view, resolution record,
  and activity timeline
- [x] support persistent assignment, reassignment, due dates, Work Item completion, and assignee
  filtering with actual PostgreSQL relationships
- [x] keep sample identities non-authenticating and attribute activity only to the signed-in owner
- [x] add shared case/member fixtures and a backwards/forwards migration preservation test
- [x] document backend-first deployment and the future Slack/Pumble/Linear/email event seam

```text
backend Ruff            PASS - format and lint
migration consistency   PASS - model state current; legacy assignment preservation tested
Django checks           PASS - local checks
backend tests           PASS - 110 tests, 91.25% branch coverage
frontend lint           PASS - zero warnings
frontend typecheck      PASS
frontend tests          PASS - 17 files, 44 tests
frontend build          PASS - Next.js 16.3, 36 generated routes/assets
browser verification    PASS - 1440 desktop light, 390x844 mobile dark, system dark with reduced
                          motion, 44px controls, zero overflow, zero production console errors
security diff scan      PASS AFTER HARDENING - all 55 implementation files and all 7 remediation
                          files reviewed; no reportable findings remain
```

## Observable workflows, model connectivity, and delivery handoffs

- [x] persist truthful run phases from queue/preparation through validation, save, completion, or
  failure and show a real elapsed timer without fake progress percentages
- [x] support Amazon Bedrock bearer API keys, approved AWS Regions, exact three-tier model mappings,
  Converse structured output, and safe provider error normalization
- [x] add governed public HTTPS OpenAI-compatible connections with encrypted credentials, explicit
  tier mappings, DNS/IP validation, redirect refusal, and no per-run URL/model override
- [x] add a ten-minute one-time pairing flow and outbound connector for loopback/private Ollama,
  LM Studio, vLLM, or another OpenAI-compatible local model host
- [x] persist connector jobs and leases in PostgreSQL; store connector authorization only as a
  one-way digest and schema-validate every returned result
- [x] add explicit Bug Triage actions for reviewed Work Items, Meeting Actions, and Work Status
- [x] add a personal four-state Work Items board with editable scope, type, sample owner, and due date
- [x] retain source-run/handoff lineage and keep all drafts/items scoped to the authenticated owner
- [x] document deployment order, Bedrock requirements, local connector setup, residual endpoint
  egress risk, and the no-Redis/no-worker decision for the personal preview

```text
backend Ruff            PASS - 86 files formatted, zero lint findings
Django checks           PASS - migrations current, local and production deploy checks
backend dependencies    PASS - pip check found no broken requirements
backend tests           PASS - 103 tests, 90.42% branch coverage
frontend lint           PASS - zero warnings
frontend typecheck      PASS
frontend tests          PASS - 16 files, 42 tests
frontend build          PASS - Next.js 16.3, 33 generated routes/assets
browser verification    PASS - 1440 desktop, 390x844 mobile, light/dark/system, reduced motion,
                          all three Demo workflows, Simple/Advanced, mobile navigation, zero
                          overflow, zero console/page errors, zero automated WCAG A/AA violations
security diff scan      PASS AFTER REMEDIATION - all 61 changed runtime/contract files reviewed;
                          one medium custom-provider redirect issue found, fixed, and regression-tested
```

## Production Live authentication recovery + resilient provider vault hotfix

- [x] correlate production 401s across `/me`, execution options, provider credentials, and Bug
  Triage with the shared WorkOS Bearer boundary
- [x] resolve the canonical WorkOS OIDC metadata and set Render `WORKOS_ISSUER` to its exact
  `issuer` value, including the environment's distinct default-application client ID
- [x] keep Gemini, OpenAI, and Qwen connection cards available when provider-status queries fail
- [x] expose encrypted API-key entry from every degraded provider card without assuming that a
  previously saved credential is absent
- [x] add accessible retry, sign-in refresh, and request-ID details for authenticated status errors
- [x] add a workflow-level 401 recovery path while preserving the user's submitted input
- [x] regression-test provider key entry during a shared authenticated-status outage
- [x] run non-deploy Django checks against SQLite test settings so Windows CI does not wait on the
  intentionally unavailable PostgreSQL service; the deploy check still uses production settings

```text
backend Ruff            PASS
backend tests           PASS - 73 tests, 94.41% coverage
frontend lint           PASS - zero warnings
frontend typecheck      PASS
frontend tests          PASS - 13 files, 39 tests
frontend build          PASS - Next.js 16.3, 29 generated routes/assets
production API deploy   PASS - Render live with the OIDC-discovered WorkOS issuer
production Live smoke   PASS - signed-in Gemini Bug Triage, 543 tokens, private history persisted
```

## Live Mode reliability + team-ready workflow intake hotfix

- [x] preserve WorkOS's full configured access-token issuer and regression-test the previous
  visible-client-ID production `InvalidIssuerError`
- [x] restrict shared platform spending to Gemini with `AI_PLATFORM_PROVIDERS=gemini`; OpenAI and
  Qwen remain vetted personal-key integrations only
- [x] reset the versioned browser provider preference to Gemini so an unavailable historical
  OpenAI choice cannot surprise users after deployment
- [x] keep encrypted per-user API-key create, rotate, status, and delete controls for Gemini,
  OpenAI, and Qwen, including clear personal-key and billing guidance
- [x] make Simple input the default for Bug Triage, Meeting Actions, and Status Update
- [x] reveal evidence, routing, ownership, participants, audience, and delivery controls only in
  Advanced input
- [x] add five clearly fictional `example.invalid` sample collaborators spanning operations,
  support, development consulting, software engineering, and quality
- [x] expose the sample pod in authenticated and public Demo Mode navigation without creating
  accounts, invitations, access grants, or notifications
- [x] classify deterministic issue intake as product defect, configuration/process, or
  needs-more-evidence and route it to engineering, support, or operations respectively
- [x] preserve selected triage owner, meeting coordinator, and status author in validated Live and
  Demo result contracts; models are explicitly forbidden from inventing collaborator IDs

```text
backend Ruff            PASS
Django checks           PASS
backend tests           PASS - 73 tests, 94.41% coverage
frontend lint           PASS - zero warnings
frontend typecheck      PASS
frontend tests          PASS - 13 files, 38 tests
frontend build          PASS - Next.js 16.3, 29 generated routes/assets
browser verification    PASS - 1440 desktop, 390x844 mobile, light/dark, all three workflows,
                          Simple/Advanced states, ownership/routing results, zero overflow,
                          zero console warnings/errors
production Live smoke   PASS - signed-in Gemini Bug Triage persisted to private history
```

## Live Mode + personal provider integrations

- [x] authenticated Live Mode for all three approved workflows
- [x] Gemini, OpenAI, and Qwen provider catalog with exact server-owned model mappings
- [x] personal Gemini/OpenAI/Qwen API-key create, rotate, list-status, and delete flows
- [x] dedicated Fernet/MultiFernet key ring with encrypted-at-rest credentials and rotation support
- [x] personal credentials take precedence over platform credentials without cross-user fallback
- [x] API responses expose only configuration state, a short SHA-256 fingerprint, and non-secret
  provider metadata; plaintext and ciphertext are never returned
- [x] Qwen endpoints are constructed from approved regions and strict workspace hostname labels;
  arbitrary URLs and model IDs are rejected
- [x] Qwen non-thinking JSON mode enforces the server intelligence-tier budget with
  `max_completion_tokens`
- [x] run history records whether execution used a personal or platform credential without storing
  the credential itself
- [x] polished responsive Settings credential vault with password inputs, masked status, provider
  onboarding links, accessible errors, and no browser persistence of keys
- [x] provider availability and credential source are resolved per authenticated user
- [x] Render Blueprint generates `PROVIDER_CREDENTIAL_ENCRYPTION_KEYS` instead of embedding a key
- [x] deployment and rotation runbook documented in
  `docs/11_LIVE_MODE_BYOK_PROVIDER_INTEGRATIONS.md`

## Live Mode verification in this workspace

```text
backend Ruff            PASS - formatting and lint
migration consistency   PASS - no uncommitted model changes
Django checks           PASS - local and production deployment checks
backend tests           PASS - 71 tests, 94.29% coverage
Python dependency check PASS
frontend lint           PASS - zero warnings
frontend typecheck      PASS
frontend tests          PASS - 12 files, 34 tests
frontend build          PASS - Next.js 16.3, 27 generated routes/assets
browser verification    PASS - 1440 desktop, 390x844 mobile, light/dark, reduced motion,
                          credential save/delete states, zero overflow, 44px mobile actions
accessibility           PASS - zero automated WCAG A/AA/2.1/2.2 violations; one contrast item
                          required manual review because the audit cannot resolve a gradient
security diff scan      PASS - 39/39 runtime files reviewed; one low-severity Qwen output-limit
                          issue found, fixed with max_completion_tokens, and regression tested
```

The final verification used a disposable clean copy on local `C:` storage because package extraction
on the mapped `X:` drive repeatedly stalled. The repository source was the code under test. A live
external-provider smoke was intentionally not run without a disposable user credential; adapter,
authorization, persistence, and error boundaries are covered by mocked integration tests.

## Vercel + Render Free production deployment

- [x] Vercel owns the Next.js frontend; Render Blueprint no longer creates a duplicate frontend
- [x] Render Free Django and PostgreSQL resources target Singapore
- [x] PostgreSQL public ingress is disabled in the Blueprint and deployed database
- [x] Node 24 and Python 3.14.3 production runtimes are pinned
- [x] free-tier migrations and expired-run purge run in the backend build command
- [x] Render paid cron, Key Value, workers, and object storage are omitted because they are not
  required by the current hobby workload
- [x] Render Blueprint passes the current published JSON schema
- [x] clean verification copy passes frontend lint, typecheck, 31 tests, and production build
- [x] clean verification copy passes backend format, lint, migrations, system checks, and 50 tests at
  94.97% coverage
- [x] Vercel production deployment and environment binding at `https://opspilot-dev.vercel.app`
- [x] Vercel server functions colocated with the backend in Singapore (`sin1`)
- [x] Render Free API deployment and environment binding at
  `https://opspilot-api-dhk7.onrender.com`
- [x] Render Free PostgreSQL provisioned in Singapore with external ingress disabled
- [x] production API health, allowed CORS origin, unauthenticated rejection, and clean runtime logs
- [x] production browser smoke across desktop/mobile, light/dark, reduced motion, and all three Demo
  Mode workflows
- [x] production WCAG A/AA audit reports zero violations
- [ ] WorkOS dashboard callback allowlist and signed-in end-to-end browser smoke

Free-tier operating note: the deployed Postgres instance expires on September 13, 2026 unless it is
upgraded or replaced, the web service can cold-start after inactivity, and strict scheduled physical
purging remains deferred because Render cron jobs are paid. Expired runs are still hidden immediately
by the application and purged on deploy.

## First-run verification

- [x] repository root verified
- [x] expected Git remote verified (`https://github.com/XVDev21/OpsPilot-dev.git`)
- [x] `frontend/` scaffold created with Next.js 16.3 App Router
- [x] frontend dev server works in Windows PowerShell
- [x] lint passes
- [x] typecheck passes
- [x] tests pass (11 files, 31 tests)
- [x] production build passes (26 generated routes/assets)
- [x] 1440x900 desktop checked
- [x] 1024x768 desktop/tablet checked
- [x] 768x1024 tablet checked
- [x] 390x844 mobile checked
- [x] 360x800 mobile checked
- [x] light theme checked
- [x] dark theme checked
- [x] system theme checked in light and dark OS modes
- [x] reduced motion checked
- [x] automated WCAG A/AA/2.2 audit passes with zero violations on landing and workflow result scopes
- [x] production server browser smoke passes with no page errors
- [x] Django 5.2 LTS service runs in Windows PowerShell
- [x] backend Ruff, migrations, system, deployment, test, coverage, and dependency checks pass
- [x] frontend/backend shared v1 contract fixtures pass
- [x] Gemini real structured-output smoke passes on the default Efficient tier
- [x] OpenAI reaches the live API and safely normalizes unavailable-quota responses
- [x] Render Blueprint passes Render's published JSON schema

## Frontend Part 1 visible surfaces

- [x] landing
- [x] product page
- [x] security page
- [x] app overview
- [x] workflow catalog
- [x] Bug Triage form and result
- [x] Meeting Actions form and result
- [x] Status Update form and result
- [x] shared final result architecture
- [x] deterministic Demo Mode
- [x] copy result feedback
- [x] responsive public navigation
- [x] responsive app navigation
- [x] theme selector
- [x] reduced-motion behavior

## Implemented contracts

- Typed workflow registry for the three approved workflow IDs
- Zod input and output schemas for every workflow
- Schema-valid deterministic sample input and output fixtures
- Pure local Demo Mode execution with no fake request or artificial delay
- React Hook Form validation with repeatable evidence and participant fields
- Shared responsive runner with workflow-specific forms and result renderers

## Frontend Part 2 implementation

- [x] WorkOS AuthKit callback, sign-in, sign-up, protected app proxy, and server sign-out
- [x] authenticated application shell with real WorkOS profile fields
- [x] server-only WorkOS Bearer-token forwarding to Django
- [x] centralized typed API clients with timeout, request IDs, normalized errors, and Zod response validation
- [x] TanStack Query wiring with bounded retry behavior and no 401 retry loop
- [x] Live Mode workflow mutation using the existing final result components
- [x] deterministic public and authenticated Demo Mode fallback
- [x] history list, status filters, empty/error states, run detail, copy, and confirmed delete
- [x] settings for account state, appearance, and execution mode
- [x] public authentication CTAs and separate guest demo routes
- [x] local WorkOS environment configured in gitignored `frontend/.env.local`
- [x] WorkOS hosted sign-in verified in a browser with Google available
- [x] public Django health and signed-out Next.js API boundary verified
- [ ] authenticated WorkOS access-token call to Django verified with a real signed-in browser session
- [x] final desktop/mobile/light/dark/system/reduced-motion browser pass

## Frontend Part 2 verification in this workspace

```text
dependency install       PASS - lockfile current, 0 vulnerabilities
full ESLint              PASS
full TypeScript          PASS with installed WorkOS and TanStack packages
full test suite          PASS - 10 files, 28 tests
production build         PASS - Next.js 16.3, 25 routes/assets
browser verification     PASS - desktop, mobile, themes, reduced motion, workflows, AuthKit
```

The Windows scripts use Next.js' supported Webpack path for `dev` and `build`. Turbopack repeatedly stalled on the mapped `X:` drive and reported a slow/network filesystem; Webpack completes reliably in the required Windows-native workflow.

## Backend Part 1 implementation

- [x] split local, test, and production Django settings
- [x] SQLite local and PostgreSQL production configuration
- [x] UUID `AppUser` identity cache keyed by authoritative WorkOS user ID
- [x] UUID `WorkflowRun` persistence with lifecycle, prompt version, provider metadata, and ownership index
- [x] WorkOS RS256 Bearer verification through client-specific JWKS
- [x] required issuer, subject, client ID, issued-at, and expiration claim validation
- [x] bounded JWKS cache/network settings and retryable authentication-outage errors
- [x] request-ID middleware and stable production-safe API error envelope
- [x] authenticated `/me`, workflow registry, history, detail, and delete endpoints
- [x] cross-user access prevention in selectors and tests
- [x] Django Ninja OpenAPI Bearer security definition
- [x] versioned shared API fixtures in `contracts/v1/`
- [x] Linux/Windows backend and frontend GitHub Actions jobs
- [x] Dependabot configuration for npm, pip, and GitHub Actions
- [x] production-readiness initiative and release-gate plan

Backend Part 1 intentionally does not expose a workflow-run `POST` endpoint. Live provider execution
belongs to Backend Part 2 so run state, provider errors, schema validation, and persistence are added as
one complete transaction boundary.

## Backend Part 1 verification in this workspace

```text
Ruff format             PASS - 48 files
Ruff lint               PASS
migration consistency   PASS - no model changes missing migrations
Django system check     PASS
Django deploy check     PASS - production settings, fail level ERROR
backend tests           PASS - 24 tests
backend coverage        PASS - 96.13% (90% gate)
Python dependency check PASS - no broken requirements
frontend lint           PASS
frontend typecheck      PASS
frontend tests          PASS - 10 files, 28 tests
frontend build          PASS - Next.js 16.3, 25 routes/assets
browser integration     PASS - desktop, 390x844 mobile, light/dark, Demo workflow, AuthKit redirect
API smoke               PASS - Django health and stable signed-out boundary
```

The final frontend gate ran from a clean verification copy on local `C:` storage because npm package
extraction left an incomplete ignored `node_modules/` tree on the mapped `X:` drive. The source under
test was the repository source. Use the recommended `C:\Dev\OpsPilot-AI` path for the most reliable
Next.js development loop.

## Verification notes

Final commands executed from `frontend/`:

```text
npm run lint       PASS
npm run typecheck  PASS
npm test           PASS - 28 tests
npm run build      PASS - Next.js production build, 25 routes/assets
```

Browser verification covered the 1440x900 desktop landing and demo, 390x844 and 360x800 mobile layouts, public/demo mobile sheets, light/dark/system themes, reduced motion, all three deterministic workflow submissions, validation errors, copy confirmation, 44px mobile targets, horizontal overflow, hydration, console errors, hosted WorkOS sign-in with Google, protected-route redirects, and structured unauthenticated API responses.

## Intentional deferrals

- organization/workspace authorization
- paid billing and monthly usage envelopes
- full account export and account erasure self-service
- production service creation, final domains, and DNS
- durable background queues unless measured synchronous load requires them

## Next-phase prerequisites

- Render `WORKOS_ISSUER` must remain the exact custom AuthKit issuer exposed by the production
  sign-in route. Deploy the backend without clearing or rotating any encryption keys.
- Keep `AI_PLATFORM_PROVIDERS=gemini`. The existing Gemini platform key remains the default
  low-cost route; the platform OpenAI key is intentionally unused and can be removed from Render.
- Deploy the backend before the frontend, confirm health, then exercise WorkOS → Next.js BFF →
  Django → Gemini → private history with a signed-in production account.
- OpenAI requires a funded personal API project and is not required for this release.
- Qwen requires a region-specific key and, for Singapore or Beijing, the Alibaba Model Studio
  workspace ID. Add these through Settings as a personal credential when ready; no Qwen secret is
  required to merge this change.
- Sign in once after deployment and run one disposable-key smoke for each personally enabled provider through
  WorkOS -> Next.js BFF -> Django -> provider -> history, then delete the disposable credential and
  inspect Render/Vercel logs for secret or prompt leakage.
- Preserve older encryption keys after rotation until existing credentials have been re-saved or a
  re-encryption migration has completed.

## Backend Part 2 implementation

- [x] provider-neutral synchronous workflow service with provider calls outside database transactions
- [x] official Google GenAI structured outputs and OpenAI Responses structured outputs
- [x] pinned server-owned model mapping for Efficient, Balanced, and Deep intelligence tiers
- [x] Gemini Efficient low-cost/low-latency default and optional OpenAI compatibility
- [x] workflow-specific evidence guardrails and versioned hidden prompt compilation
- [x] pending/completed/failed persistence with provider, model, tier, duration, and token metadata
- [x] stable provider error normalization without key, prompt, or raw provider-response leakage
- [x] bounded workflow input schemas and output-token ceilings
- [x] personal-account throttling before provider calls (5/minute and 30/day defaults)
- [x] 30-day run expiry, immediate history hiding, legacy backfill, and daily purge command
- [x] authenticated execution-options and live workflow-run endpoints
- [x] persisted frontend provider/tier preferences with unavailable-provider states
- [x] token usage shown after successful live runs
- [x] Vercel frontend plus Render Free Django/PostgreSQL Blueprint for the approved hobby deployment
- [x] Singapore region and Node/Python production runtime pins
- [x] free-tier migration/purge build fallback with paid retention cron explicitly deferred
- [x] deployment and WorkOS callback runbook

## Backend Part 2 verification in this workspace

```text
backend Ruff            PASS - formatting and lint
migration consistency   PASS - migration applied locally
Django checks           PASS - local and production deploy settings
backend tests           PASS - 50 tests, 94.97% coverage
Python dependency check PASS
Gemini live smoke       PASS - structured StatusUpdateOutput, 173 input / 84 output tokens
OpenAI live boundary    PASS - request reached API; insufficient quota normalized as non-retryable
frontend lint           PASS
frontend typecheck      PASS
frontend tests          PASS - 11 files, 31 tests
frontend build          PASS - Next.js 16.3, 26 routes/assets
Render schema           PASS - current published Render JSON schema
browser verification    PASS - settings desktop/mobile, light/dark, reduced motion, persistence,
                          zero overflow, 44px targets, zero WCAG A/AA/2.2 violations, AuthKit redirect
Vercel production       PASS - READY, canonical alias returns 200, no runtime errors
Render production       PASS - live deploy, health 200, frontend-only CORS, protected route 401
production Demo Mode    PASS - all three workflows produce structured results in the deployed app
production visual       PASS - 1440x900 and 390x844 in light/dark, reduced motion active
production WCAG         PASS - zero automated WCAG A/AA violations on the deployed landing page
```

Frontend Node gates ran from a clean verification copy on local `C:` storage. The mapped `X:` drive
again stalled Node tooling and corrupted one installed Python dependency during package extraction;
the same requirements installed cleanly on `C:` and reached the OpenAI API.
