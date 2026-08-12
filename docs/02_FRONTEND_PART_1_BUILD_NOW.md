# 02 — Frontend Part 1: Build the Visible Product Now

## Goal

Deliver **at least 60% of the final visible application** during the first Codex coding task.

When this part is complete, the application should already be convincing in a hackathon demo even without Django or live AI.

## Required libraries

Use current compatible versions of:

- Next.js
- React
- TypeScript
- Tailwind CSS
- next-themes
- Motion for React
- Lucide React
- React Hook Form
- Zod
- selected shadcn/ui primitives

Use browser/testing tooling appropriate to the installed skills and current environment.

## Design system

### Themes

Support:

```text
Light
Dark
System
```

Use semantic tokens rather than hardcoded theme-specific utility classes across product components.

Suggested light palette:

```css
--background: #f7f8fc;
--surface: #ffffff;
--surface-raised: #ffffff;
--surface-soft: #f0f3f9;
--surface-accent: #eef2ff;
--foreground: #172033;
--foreground-muted: #667085;
--foreground-soft: #8a94a6;
--primary: #4f46e5;
--primary-hover: #4338ca;
--primary-foreground: #ffffff;
--accent: #0891b2;
--border: #dce3ed;
--border-strong: #bbc7d6;
--success: #16803c;
--warning: #b45309;
--danger: #b42318;
--focus: #6366f1;
```

Suggested dark palette:

```css
--background: #090e1a;
--surface: #111827;
--surface-raised: #162033;
--surface-soft: #192437;
--surface-accent: #20264a;
--foreground: #f6f8fb;
--foreground-muted: #a0aec0;
--foreground-soft: #7f8ca3;
--primary: #818cf8;
--primary-hover: #a5b4fc;
--primary-foreground: #101624;
--accent: #22d3ee;
--border: #29364a;
--border-strong: #40516a;
--success: #4ade80;
--warning: #fbbf24;
--danger: #fb7185;
--focus: #a5b4fc;
```

Codex may improve values after browser inspection.

### Typography

Use Geist or Inter-style typography.

Hierarchy:

- hero: strong display scale
- page title: 30–36px
- section title: 20–24px
- body: 14–16px
- metadata: never so small it becomes difficult to read

### Shape

- buttons: ~10px radius
- fields: ~10px
- cards: 16px
- major feature panels: 20–24px
- pills: full radius

### Visual depth

Use:

- layered surfaces
- restrained shadows
- subtle borders
- active accent areas
- original SVG/React illustrations
- changes in scale/space
- meaningful motion

Do not put every section inside an identical bordered card.

## Motion

Timing guidance:

```text
micro: ~120ms
control: ~180ms
panel: ~240ms
page/narrative: ~350ms
```

Use motion for:

- hero transformation sequence
- workflow-card hover/focus
- mobile drawer
- page entrance
- Demo result reveal
- state transitions
- copy confirmation

Respect reduced motion.

No fake model typing or fake progress.

## Landing page `/`

### Header

Desktop:

- brand/logo
- Product
- How it works anchor
- Security
- Sign in visual action
- Start free visual action

Part 1 note:

Until WorkOS is implemented, auth CTAs should route users into the Demo Mode app experience or a deliberate informational state. Do not create a fake login form.

Mobile:

- brand
- primary CTA
- menu sheet

### Hero

Eyebrow:

`AI workflow automation for everyday work`

Headline:

`Stop rewriting the same AI prompts.`

Supporting:

`Choose the job you need done, provide the information you already have, and let OpsPilot turn it into a structured result.`

Actions:

- `Try the workflows`
- `See how it works`

### Hero visualization

Create original animated media showing:

```text
rough fragments
→ selected workflow lane
→ structured result
```

Include three conceptual lanes representing:

- technical
- collaboration
- operations

Mobile uses a simplified version.

No external stock photo dependency.

### Workflow cards

Three high-quality cards.

Each contains:

- custom small visual
- icon
- category
- title
- benefit
- action

Make them visually distinct while still part of one system.

### How it works

Three steps:

1. Choose the job
2. Provide the work
3. Use the result

### Before / After

Show the automation value visually.

Before:

```text
Prompt
→ rewrite
→ request formatting
→ output
```

OpsPilot:

```text
Choose
→ provide
→ result
```

### Trust/security strip

Keep claims conservative:

- structured workflow outputs
- user-controlled input
- technical findings remain reviewable
- authenticated history later

### Footer

Complete final footer.

## Product page `/product`

Explain all three workflows with real reusable components.

Each section should show:

- common problem
- example input
- result preview
- time/effort automation benefit

Do not use image placeholders.

## Security page `/security`

Explain the planned security model truthfully:

- Demo Mode local/deterministic
- WorkOS account security coming in Part 2
- Live workflow data later goes to configured backend AI provider
- technical triage remains advisory
- user data/history later belongs to authenticated user

Do not make compliance certifications claims.

## App shell `/app`

Part 1 is Demo Mode.

Desktop:

- sidebar
- compact top bar
- main content

Sidebar:

- Overview
- Workflows

Footer area:

- `Demo Mode` badge
- theme selector

Mobile:

- top bar
- navigation sheet
- no fixed desktop sidebar

## App overview

Headline:

`What would you like to automate?`

Supporting:

`Start with the task—not the prompt.`

Use three large launch surfaces.

Include a smaller animated flow:

```text
Input → Workflow → Structured result
```

## Workflow catalog

Route:

```text
/app/workflows
```

Only the three real workflows.

Categories:

- Technical
- Collaboration
- Operations

No future-feature filler cards.

## Shared workflow runner

Create one architecture-driven runner used by all workflows.

Desktop:

```text
input | result
```

Mobile:

```text
input
action
result
```

## Workflow registry

Create typed registry.

Each workflow defines:

- id
- title
- category
- description
- icon
- input schema
- sample input
- sample output
- CTA label

## Bug Triage

Form sections:

### Issue
- title
- affected area
- observed behavior

### Expectation
- expected behavior

### Evidence
- repeatable known evidence

### Advanced
- relevant settings
- constraints

CTA:

`Run demo triage`

Result:

- summary
- confirmed facts
- evidence gaps
- likely category badge
- recommended checks
- confidence
- human-review callout
- copy result

## Meeting Actions

Input:

- meeting title
- meeting notes
- participants optional
- date optional

CTA:

`Run demo extraction`

Result:

- summary
- decisions
- action items
- owner when provided
- deadline when provided
- open questions
- unresolved items
- copy result

## Status Update

Input:

- work notes
- audience
- format

Formats:

- Daily stand-up
- Manager update
- Technical update

CTA:

`Run demo update`

Result:

- completed
- in progress
- blocked/waiting
- next steps
- copy-ready update
- copy result

## Demo Mode

Demo Mode is required and functional.

Rules:

- clearly labeled
- final form validation runs
- sample input can populate each form
- user may edit sample input
- deterministic result follows the final output schema
- no fake provider request
- no artificial delay
- same final result UI planned for live mode
- copy button works

## Forms

Use React Hook Form + Zod.

Required:

- accessible labels
- helpful descriptions
- inline field errors
- repeatable arrays where needed
- keyboard-friendly add/remove
- reset
- load sample
- no sensitive automatic localStorage persistence

## Responsive requirements

Verify at least:

```text
1440×900
1024×768
768×1024
390×844
360×800
```

No horizontal scroll.

Mobile:

- 44px touch targets
- stacked forms/results
- hero media simplification
- usable notes textarea
- navigation sheet works
- actions not hidden behind viewport controls

## Accessibility

Target WCAG 2.2 AA:

- skip link
- landmarks
- correct headings
- visible focus
- errors associated to fields
- sufficient contrast
- not color-only
- reduced motion
- accessible sheets/dialogs

## Tests

Minimum:

- workflow registry tests
- workflow input-schema tests
- Demo Mode fixture-schema tests
- landing smoke
- app navigation
- sample input → result
- theme switching
- mobile nav
- reduced-motion behavior where practical

## Part 1 completion criteria

Do not stop until:

- no Next.js starter UI remains
- landing looks intentionally designed
- product/security pages are complete
- app shell looks final
- all 3 workflow forms are final
- all 3 result views are final
- Demo Mode works end to end
- copy works
- themes work
- desktop/mobile work
- motion/reduced-motion work
- lint passes
- typecheck passes
- tests pass
- production build passes
- browser inspection has been performed and visible defects fixed
