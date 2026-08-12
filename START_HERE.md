# START HERE — OpsPilot AI Greenfield Build

This package is designed for a **blank Git repository**.

Do not create a Next.js or Django starter manually before using it.

## Preferred setup

Place the contents of this package directly in the root of the blank OpsPilot repository:

```text
OpsPilot-AI/
├── START_HERE.md
├── AGENTS.md
├── IMPLEMENTATION_STATUS.md
├── CODEX_START_NOW_PROMPT.md
├── README.md
└── docs/
```

Then open that repository folder in Codex and use `CODEX_START_NOW_PROMPT.md`.

## What Codex must do on the first run

The first run is intentionally substantial.

Codex should:

1. Verify it is operating in the correct Git repository.
2. Read the project plans.
3. Scaffold `frontend/` using the current supported Next.js starter.
4. Establish the frontend architecture and design system.
5. Install only the dependencies required by Frontend Part 1.
6. Build the landing page, public product/security pages, app shell, and all three workflow experiences.
7. Implement deterministic Demo Mode using final result schemas.
8. Implement light, dark, and system themes.
9. Implement responsive mobile layouts and purposeful motion.
10. Run lint, type checks, tests, build, and browser verification.
11. Iterate on visible defects before stopping.
12. Update `IMPLEMENTATION_STATUS.md`.

It must **not** create the Django backend during the first run.

## First visible milestone

The first coding run should produce a polished, presentation-ready frontend that already demonstrates:

```text
Landing
→ Workflow catalog
→ Bug Triage / Meeting Actions / Status Update
→ Real form
→ Run Demo
→ Final structured result
```

Demo Mode is intentionally deterministic and clearly labeled. It is not a fake AI request.

## Next milestones

After approving the first UI milestone:

1. Frontend Part 2 — WorkOS + live API-ready frontend
2. Backend Part 1 — Django foundation and WorkOS JWT
3. Backend Part 2 — Gemini workflow engine
4. End-to-end integration and deployment
