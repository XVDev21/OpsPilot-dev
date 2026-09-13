# Codex — continue OpsPilot

This is an existing deployed application, not a blank repository. Preserve the implemented Next.js
frontend, Django/Ninja backend, local connector, database history, and Demo Mode.

First verify `Get-Location`, `git rev-parse --show-toplevel`, `git remote -v`, and `git status`.
Then read `AGENTS.md`, `START_HERE.md`, `IMPLEMENTATION_STATUS.md`, recent commits and PRs, and the
current case/collaboration/deployment documentation referenced there.

Work on the user's requested phase. Do not repeat scaffolding or infer that shipped features are
unimplemented from the original bootstrap plans. Distinguish implementation, automated verification,
and actual production integration evidence.

Before editing, state files, dependencies, contracts, and non-goals. After implementation, run the
appropriate lint, typecheck, tests, build, and browser checks and update `IMPLEMENTATION_STATUS.md`.
Use Windows PowerShell and npm; keep frontend and backend independently deployable.
