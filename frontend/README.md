# OpsPilot AI frontend

The visible OpsPilot product is a Next.js App Router application with three task-oriented workflows:

- Bug / Issue Triage
- Meeting to Action Items
- Work to Status Update

Frontend Part 1 runs in clearly labeled deterministic Demo Mode. Forms use the final Zod contracts and production result components, but do not call a backend or AI provider.

## Windows development

From `frontend/` in PowerShell:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality gates

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Environment

Copy `.env.example` to `.env.local` only when local overrides are needed.

- `NEXT_PUBLIC_SITE_URL` supplies the canonical host for generated metadata such as the sitemap.
- `NEXT_PUBLIC_API_BASE_URL` is reserved for Frontend Part 2 when the independent Django service is introduced.

No provider secret belongs in the frontend environment.
