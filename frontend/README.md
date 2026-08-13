# OpsPilot AI frontend

OpsPilot is a Next.js App Router application with three task-oriented workflows:

- Bug / Issue Triage
- Meeting to Action Items
- Work to Status Update

The public `/demo` workspace runs clearly labeled deterministic Demo Mode. The authenticated `/app` workspace uses WorkOS AuthKit, defaults to Live Mode, and sends requests through same-origin Next.js route handlers so the WorkOS access token remains server-side. Live workflows, account history, and backend identity are ready for the independent Django API.

## Windows development

From `frontend/` in PowerShell:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Use Node.js 22.11 or newer. WorkOS AuthKit and the WorkOS Node SDK require that baseline.

## WorkOS dashboard

Configure the local application with:

```text
Redirect URI:       http://localhost:3000/auth/callback
Sign-in URL:        http://localhost:3000/sign-in
Default logout URI: http://localhost:3000/
```

Enable Google as an authentication method in the WorkOS dashboard. WorkOS staging can use the provider's shared Google OAuth credentials; production should use credentials owned by the project.

## Quality gates

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Environment

Copy `.env.example` to the gitignored `.env.local` and provide:

- `WORKOS_CLIENT_ID` for the OpsPilot WorkOS application.
- `WORKOS_API_KEY` as a server-only WorkOS secret.
- `WORKOS_COOKIE_PASSWORD` as a random value at least 32 characters long.
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` matching the registered callback URL.
- `NEXT_PUBLIC_SITE_URL` for generated metadata such as the sitemap.
- `NEXT_PUBLIC_API_BASE_URL` for the independently deployed Django service.

Never commit `.env.local`. Gemini and other AI-provider secrets belong only in the future backend environment, not in this frontend.
