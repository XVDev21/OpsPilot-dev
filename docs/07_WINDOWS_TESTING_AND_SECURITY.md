# 07 — Windows Development, Testing, Security, and Definition of Done

## Windows local development

Recommended location:

```text
C:\Dev\OpsPilot-AI
```

Avoid OneDrive-managed development folders where practical.

## Frontend

```powershell
cd C:\Dev\OpsPilot-AI\frontend
npm install
npm run dev
```

## Backend later

```powershell
cd C:\Dev\OpsPilot-AI\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install --upgrade pip
pip install -r requirements.txt
py manage.py migrate
py manage.py runserver
```

No WSL required.

If activation is inconvenient, use:

```powershell
.\.venv\Scripts\python.exe manage.py runserver
```

## Frontend quality gates

Required scripts:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Browser checks:

```text
1440 desktop
1024 tablet
390 mobile
light
dark
system
reduced motion
```

## Backend quality gates

```powershell
py manage.py check
pytest
```

## Contract tests

Keep frontend TypeScript types and Django schemas aligned with sample JSON fixtures for:

- API errors
- current user
- workflow metadata
- create run
- run detail
- history

Optional later: generate TypeScript types from Django Ninja OpenAPI after contracts stabilize.

## Security

### Authentication

Django must validate:

- signature
- expiration
- issuer
- intended WorkOS application/client/audience claim
- `sub`

### Tokens

Never:

- localStorage
- sessionStorage
- logs
- source control

for WorkOS access tokens.

### AI

- Gemini API key backend only
- request size limits
- provider timeout
- Pydantic output validation
- no arbitrary user-provided hidden system prompts
- technical triage shows human-review requirement

### API

- user ownership checks
- explicit CORS
- request IDs
- no stack traces in production
- `DEBUG=False` production

## Accessibility

Target WCAG 2.2 AA.

Required:

- keyboard access
- visible focus
- labels/errors
- contrast
- semantic structure
- reduced motion
- 44px mobile targets
- accessible menus/sheets/dialogs

## Performance

Frontend:

- keep hero animation lightweight
- prefer SVG/CSS to heavy media
- avoid unnecessary client components
- lazy-load noncritical visuals

Backend:

- index run history by user/date
- bounded input size
- provider timeout
- avoid N+1 history queries

## Hackathon final definition of done

### Visible product

- [ ] polished landing
- [ ] product page
- [ ] security page
- [ ] polished app shell
- [ ] Bug Triage
- [ ] Meeting Actions
- [ ] Status Update
- [ ] final result views
- [ ] Demo Mode
- [ ] light/dark/system
- [ ] mobile
- [ ] purposeful animations
- [ ] reduced motion

### Live product

- [ ] WorkOS Google sign-in
- [ ] protected app
- [ ] Django Ninja backend
- [ ] Gemini
- [ ] Pydantic output validation
- [ ] persistent history
- [ ] copy result
- [ ] safe errors

### Engineering

- [ ] lint
- [ ] typecheck
- [ ] frontend tests
- [ ] frontend build
- [ ] Django checks
- [ ] backend tests
- [ ] browser desktop/mobile
- [ ] auth security verified

### Deployment

- [ ] frontend independent service
- [ ] backend independent service
- [ ] PostgreSQL
- [ ] environment documentation
- [ ] health check
