# OpsPilot AI

## Hackathon product

OpsPilot AI removes repetitive prompt-writing from everyday internal work.

Instead of asking users to build or rewrite prompts, the authenticated product centers durable
Operations Cases. Public Demo Mode still showcases the original task-oriented workflows:

- **Bug / Issue Triage**
- **Meeting → Action Items**
- **Work → Status Update**

Users provide ordinary work information and receive a controlled structured result.

## Technology

```text
Frontend:
Next.js App Router
React
TypeScript
Tailwind CSS
shadcn/ui
Motion
React Hook Form
Zod
TanStack Query
WorkOS AuthKit

Backend:
Python
Django
Django Ninja
Pydantic
PostgreSQL production
Gemini, OpenAI, Qwen, Amazon Bedrock, and governed OpenAI-compatible adapters
Outbound local connector for Ollama, LM Studio, and vLLM-compatible servers
Encrypted per-user provider credentials
```

The frontend and Django API are implemented. WorkOS Organization-backed workspaces let owners invite
real collaborators, assign role-scoped case access, and replace sample profiles without rewriting
history. Authenticated users capture case intent and evidence,
run versioned issue assessments through Gemini, OpenAI, Qwen, Bedrock, a governed compatible
endpoint, or a paired local connector, then decide when to apply, publish, and assign the result.
Deterministic public Demo Mode remains backend-independent. Gemini is the only platform-funded
provider and the only currently verified image-analysis route. Additional cloud credentials are
encrypted per user, while local models remain private behind an outbound connector.

## Local development

Frontend (PowerShell):

```powershell
cd frontend
npm install
npm run dev
```

Backend (PowerShell):

```powershell
cd backend
py -3.14 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py runserver
```

See `backend/README.md` for configuration and `IMPLEMENTATION_STATUS.md` for verified delivery
state. The production-readiness initiatives and release gates live in
`docs/09_DELIVERY_INITIATIVES_AND_RELEASE_GATES.md`. Live provider setup, credential rotation, and
deployment requirements are documented in `docs/11_LIVE_MODE_BYOK_PROVIDER_INTEGRATIONS.md`.
Observable runs, local setup, and reviewed delivery handoffs are documented in
`docs/12_OBSERVABLE_WORKFLOWS_AND_MODEL_CONNECTIONS.md`. Operations Cases, durable assignment
relationships, migration behavior, and deployment order are documented in
`docs/13_OPERATIONS_CASES_AND_ASSIGNMENTS.md`.
Case-first intake, evidence security, assessment confidence, WorkOS collaboration, and notification delivery
are documented in `docs/14_CASE_FIRST_ASSESSMENTS_AND_EVIDENCE.md`.

## Development environment

Windows only.

Use PowerShell and normal Windows paths. Do not require WSL.

Recommended repository location:

```text
C:\Dev\OpsPilot-AI
```

## Monorepo target

```text
OpsPilot-AI/
├── frontend/
├── backend/
├── docs/
├── AGENTS.md
└── render.yaml
```

The frontend and backend are independent deployable services even though they share one Git repository.

## Plan order

Read:

1. `START_HERE.md`
2. `AGENTS.md`
3. `docs/00_BOOTSTRAP_FROM_SCRATCH.md`
4. `docs/01_PRODUCT_ARCHITECTURE.md`
5. `docs/02_FRONTEND_PART_1_BUILD_NOW.md`
6. `docs/03_FRONTEND_PART_2_AUTH_AND_LIVE_API.md`
7. `docs/04_BACKEND_PART_1_DJANGO_FOUNDATION.md`
8. `docs/05_BACKEND_PART_2_WORKFLOW_ENGINE.md`
9. `docs/06_END_TO_END_AND_DEPLOYMENT.md`
10. `docs/07_WINDOWS_TESTING_AND_SECURITY.md`
11. `docs/08_OFFICIAL_REFERENCE_CHECKLIST.md`
12. `docs/09_DELIVERY_INITIATIVES_AND_RELEASE_GATES.md`
13. `docs/10_RENDER_DEPLOYMENT_RUNBOOK.md`
14. `docs/11_LIVE_MODE_BYOK_PROVIDER_INTEGRATIONS.md`
15. `docs/12_OBSERVABLE_WORKFLOWS_AND_MODEL_CONNECTIONS.md`

## Scope discipline

Frontend Part 1 intentionally delivers more than half of the visible product and should be completed before backend implementation.

Do not display unfinished future features in navigation.
