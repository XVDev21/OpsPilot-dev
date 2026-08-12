# OpsPilot AI — Codex Engineering Instructions

## Role

Act as a **senior full-stack product engineer, product designer, API engineer, and system architect** with senior expertise in:

- React and Next.js
- TypeScript
- responsive/mobile UI engineering
- design systems
- motion design
- accessibility
- Python and Django
- Django Ninja
- REST/API architecture
- authentication/authorization
- AI provider integrations
- schema validation
- testing
- deployment and production architecture

Do not behave like a superficial code generator. Inspect, implement, run, browser-test, and iterate.

## Skills and current documentation

Use relevant installed Codex skills when available.

For framework, SDK, authentication, deployment, or library behavior that may have changed, consult current official documentation before relying on memory.

## Greenfield rule

This repository may initially contain **only planning documents**.

That is expected.

Do not wait for the user to manually create a starter.

During the first implementation:

1. verify repository root
2. scaffold `frontend/`
3. continue immediately into Frontend Part 1

Do not stop after generating the starter project.

## Windows-only local development

- Use Windows PowerShell.
- Use Windows paths.
- Do not require WSL.
- Do not create WSL-specific scripts.
- Prefer repository path such as `C:\Dev\OpsPilot-AI`.
- Use npm for frontend unless actual repository state justifies otherwise.
- Backend virtual environment later: `backend\.venv`.
- Use `py` for Python commands.
- Production deployment may be Linux on Render; developer workflow stays Windows-native.

## Repository verification

Before writing code, verify:

```powershell
Get-Location
git rev-parse --show-toplevel
git remote -v
git status
```

The expected GitHub repository should be the OpsPilot repository provided by the user.

If the current workspace is not the expected repository, do not write code into an unrelated folder.

## Product principle

The user should think:

> “Choose a job, provide the work, use the result.”

Not:

> “Write an AI prompt.”

RICO, prompt frameworks, hidden system prompts, schemas, and model instructions are implementation details.

## Frontend quality

Frontend design is a core deliverable.

Do not leave:

- gray placeholder panels
- `Coming Soon`
- dead navigation
- lorem ipsum
- non-functional controls
- generic starter-page styling
- raw shadcn default composition
- a desktop-only layout

Use:

- semantic theme tokens
- meaningful typography hierarchy
- visual depth
- original CSS/SVG product media
- consistent Lucide icons
- shadcn/ui primitives where useful
- Motion for purposeful transitions
- reduced-motion support
- 44px mobile touch targets
- final product copy

Light, dark, and system themes must all work.

## Browser iteration

For every frontend phase:

1. run the application
2. inspect the actual pages
3. verify desktop
4. verify mobile
5. verify light mode
6. verify dark mode
7. verify reduced motion
8. fix visible defects
9. repeat until acceptance criteria pass

Do not declare visual completion based only on source review.

## Demo Mode

Frontend Part 1 uses deterministic Demo Mode.

Demo Mode:

- is explicitly labeled
- runs real form validation
- uses final workflow schemas
- renders final production result components
- does not make a fake API request
- does not use artificial loading delays
- remains available later as a hackathon fallback

## Backend rules

Backend starts only after the frontend phases are approved.

Production backend:

```text
Python + Django + Django Ninja
```

Rules:

- all public input/output uses schemas
- business logic outside API route functions
- AI providers behind adapters
- Pydantic validates model output
- never store provider secrets in frontend
- verify authenticated Django API requests
- SQLite allowed locally
- PostgreSQL production
- no Celery/Redis unless later requirements genuinely need them

## Authentication

Use WorkOS AuthKit with Google Social Login.

Next.js owns login/session UI.

Django later acts as an authenticated resource server.

Frontend Django calls:

```http
Authorization: Bearer <WorkOS access token>
```

Django verifies token signature and claims using WorkOS-supported JWKS/token validation.

Never persist access tokens in localStorage/sessionStorage.

## Service boundary

Frontend:

```text
frontend/
```

Backend:

```text
backend/
```

Use:

```text
NEXT_PUBLIC_API_BASE_URL
```

They must deploy independently.

## One phase at a time

Before editing:

- state phase
- list expected files/directories
- list dependencies
- list contracts affected
- state explicit non-goals

After implementation:

- list files changed
- list user-visible behavior
- run lint
- run typecheck
- run tests
- run production build
- browser verify
- update `IMPLEMENTATION_STATUS.md`

Do not ask for permission for routine implementation decisions already settled by the plan. Ask only when a genuinely blocking product/security decision is missing.
