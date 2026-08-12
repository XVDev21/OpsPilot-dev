# 03 — Frontend Part 2: WorkOS Authentication, Live API, History, and Final UI

## Objective

Convert the polished Demo Mode frontend into the complete authenticated frontend while preserving the exact design quality and result components established in Part 1.

## Additions

- WorkOS AuthKit for Next.js
- Google Social Login
- TanStack Query
- typed Django API client
- run history
- run detail
- settings/profile
- live execution states
- robust error/retry behavior

## Authentication

Use current official WorkOS AuthKit guidance for Next.js App Router.

Implement:

```text
/sign-in
/auth/callback
```

Enable Google Social Login in WorkOS.

Do not build a custom password form when hosted AuthKit is the chosen authentication experience.

Protect:

```text
/app/**
```

Signed-in application shell displays real user:

- name
- email
- avatar where available
- sign-out

## Public CTA behavior

After WorkOS exists:

- `Sign in` → real WorkOS sign-in
- `Start free` → real WorkOS sign-up/onboarding
- demo CTA may still allow explicit Demo Mode without pretending a user is signed in

## Access token

Use WorkOS-supported mechanism to acquire an API access token for Django requests.

Rules:

- token acquired only when needed
- Bearer header sent to backend
- never localStorage
- never sessionStorage
- never rendered/logged
- no infinite retry loops on 401

## Typed API client

Create a centralized client:

```text
frontend/lib/api/client.ts
```

Use:

```text
NEXT_PUBLIC_API_BASE_URL
```

Responsibilities:

- base URL
- Bearer token
- JSON handling
- timeout/AbortSignal
- normalized error envelope
- request ID extraction

Do not use raw fetch throughout feature components.

## TanStack Query

Use for:

- backend current user
- workflow metadata if backend-backed
- run history
- run detail
- create-run mutation
- delete-run mutation

Use React Hook Form for forms.

## Live workflow execution

Normal authenticated behavior:

```text
form validate
→ retrieve WorkOS token
→ POST Django
→ actual submitting state
→ receive WorkflowRun
→ render existing result component
→ refresh history
```

Part 1 result components must not be replaced by a separate live-only design.

## Live vs Demo

Normal signed-in default:

```text
Live
```

Demo Mode remains intentionally available for presentation fallback.

Clearly distinguish the mode.

Never visually present Demo output as live Gemini output.

## Loading state

Only show states genuinely known:

- validating locally
- submitting
- generating structured result

No fake percentages.

## Errors

Handle:

- local validation
- auth required
- token invalid/expired
- backend unavailable
- provider timeout
- provider rate limit
- provider unavailable
- invalid AI output
- generic server failure

Rules:

- preserve input
- retry when `retryable`
- readable explanation
- optional technical detail includes request ID
- no stack trace

## History

Routes:

```text
/app/history
/app/history/[runId]
```

List:

- workflow
- derived title
- created time
- status
- concise result preview

Keep filters minimal.

Detail:

- input summary
- final result
- provider/model/duration under Technical details
- Copy
- Delete with confirmation

Reuse result components.

## Settings

Route:

```text
/app/settings
```

Sections:

### Account
Real WorkOS profile.

### Appearance
Light / Dark / System.

### Demo Mode
Explicit setting.

Do not add unavailable provider settings in this hackathon version.

## Empty/error states

Create final states for:

- no history
- no result
- signed out
- backend unavailable

No placeholder rectangles.

## Mobile completion

Verify:

- landing auth CTA
- app protected route
- workflow submit
- result
- history
- settings
- account menu

at 390px width.

No permanent mobile sidebar.

## Part 2 acceptance

- WorkOS Google sign-in works
- protected app works
- token reaches Django correctly once backend exists
- live workflow runner is API-ready
- history UI is final
- settings UI is final
- Demo Mode remains valid
- no dead navigation
- desktop/mobile/theme/reduced-motion pass
- lint/typecheck/tests/build pass
