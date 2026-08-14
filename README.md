# OpsPilot AI

## Hackathon product

OpsPilot AI removes repetitive prompt-writing from everyday internal work.

Instead of asking users to build or rewrite prompts, the product exposes task-oriented workflows:

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
Gemini provider adapter
```

The frontend and Django API are both implemented. Live Gemini execution remains intentionally
deferred to Backend Part 2; Demo Mode stays deterministic and backend-independent.

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
`docs/09_DELIVERY_INITIATIVES_AND_RELEASE_GATES.md`.

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

## Scope discipline

Frontend Part 1 intentionally delivers more than half of the visible product and should be completed before backend implementation.

Do not display unfinished future features in navigation.
