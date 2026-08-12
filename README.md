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
TanStack Query later
WorkOS AuthKit later

Backend:
Python
Django
Django Ninja
Pydantic
PostgreSQL production
Gemini provider adapter
```

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

## Scope discipline

Frontend Part 1 intentionally delivers more than half of the visible product and should be completed before backend implementation.

Do not display unfinished future features in navigation.
