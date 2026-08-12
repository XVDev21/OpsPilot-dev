# 00 — Bootstrap From Scratch

## Objective

Start from a repository that may contain only the planning files and create a healthy frontend foundation, then continue immediately into Frontend Part 1.

Do not stop after `create-next-app`.

## Step 1 — Verify repository

In PowerShell, verify:

```powershell
Get-Location
git rev-parse --show-toplevel
git remote -v
git status
```

The project must be the intended OpsPilot repository.

If the repository has no remote yet, record that as a setup note, but do not block frontend implementation.

## Step 2 — Inspect existing files

Preserve:

```text
START_HERE.md
AGENTS.md
IMPLEMENTATION_STATUS.md
README.md
docs/
```

Do not scaffold Next.js over the repository root.

Create the frontend under:

```text
frontend/
```

## Step 3 — Scaffold frontend

Use the current officially supported Next.js starter.

Requirements:

- Next.js App Router
- React
- TypeScript
- ESLint
- Tailwind CSS
- npm
- no WSL-specific setup
- framework files under `frontend/`

Codex should verify the current scaffolding command/options before use.

Do not create the Django backend in this phase.

## Step 4 — Establish frontend architecture

Target:

```text
frontend/
├── app/
│   ├── (marketing)/
│   ├── app/
│   ├── product/
│   ├── security/
│   └── layout.tsx
├── components/
│   ├── brand/
│   ├── layout/
│   ├── marketing/
│   └── ui/
├── features/
│   └── workflows/
│       ├── bug-triage/
│       ├── meeting-actions/
│       ├── status-update/
│       ├── registry.ts
│       └── types.ts
├── lib/
│   ├── demo/
│   ├── schemas/
│   └── theme/
├── public/
├── tests/
├── package.json
├── next.config.*
└── .env.example
```

Codex may refine paths when framework conventions justify it, but keep feature boundaries clear.

## Step 5 — Add Part 1 dependencies only

Expected categories:

- theme
- icons
- motion
- form handling
- schema validation
- selected shadcn/ui primitives
- testing/browser tooling

Do not install:

- WorkOS yet
- Django-related packages
- TanStack Query unless already needed
- AI SDKs
- database SDKs
- analytics platforms

Keep dependency count controlled.

## Step 6 — Establish scripts

Frontend must expose:

```text
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

Add the required configuration so those commands actually work.

## Step 7 — Establish design tokens before page implementation

Do not build pages first and theme later.

Create:

- semantic color tokens
- typography
- radius
- shadows/elevation
- spacing rules
- motion constants
- focus treatment
- responsive page containers

Then implement visible pages.

## Step 8 — Continue directly into Frontend Part 1

After scaffold health is confirmed, continue through:

```text
docs/02_FRONTEND_PART_1_BUILD_NOW.md
```

within the same Codex task.

## Bootstrap acceptance criteria

- `frontend/` exists
- app runs in Windows PowerShell
- no starter boilerplate remains visible
- architecture supports the planned pages
- required scripts work
- design foundation exists
- Codex has begun and completed Frontend Part 1 before ending the task
