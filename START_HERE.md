# Start here — continue the existing OpsPilot application

OpsPilot is an implemented, deployed product. Do not scaffold or replace `frontend/`, `backend/`,
or `connector/`. The original bootstrap documents are historical plans, not current instructions to
restart development.

## Establish current state

1. Verify the repository root, remote, branch, and working changes using `AGENTS.md`.
2. Read `IMPLEMENTATION_STATUS.md`, including the most recent dated verification.
3. Read `README.md` and the recent Git history and pull requests.
4. Read `docs/13_OPERATIONS_CASES_AND_ASSIGNMENTS.md` and
   `docs/14_CASE_FIRST_ASSESSMENTS_AND_EVIDENCE.md` for the current product contracts.
5. Read `docs/10_RENDER_DEPLOYMENT_RUNBOOK.md` before deployment work.
6. Read `docs/15_PROJECT_REVIEW_2026_09_13.md` for the maintenance review and remaining release gaps.

## Current product

Authenticated work centers Operations Cases: capture intent and private evidence, run a versioned
assessment, review and apply the recommendation, publish and assign, record delivery updates, and
verify resolution. WorkOS workspaces and roles govern access. Resend-backed notifications use a
durable outbox. Human decisions remain authoritative.

The three deterministic public Demo workflows remain useful as a backend-independent fallback.
They are not a substitute for verifying the authenticated case lifecycle.

## Continue one bounded phase at a time

Use the Windows-native development commands in `README.md`. Preserve the independent Vercel
frontend and Render Django deployments, shared schemas, historical records, and server-only
credentials. State the proposed scope before editing and verify the resulting behavior afterward.

Prioritize database continuity and production integration evidence before expanding connector or
AI-provider scope. Never treat an old checklist, successful preview, or basic health response as
proof that every live integration has been verified.
