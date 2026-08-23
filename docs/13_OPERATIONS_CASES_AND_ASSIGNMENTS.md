# 13 — Operations Cases and Durable Assignments

## Delivered outcome

Operations Cases provide the durable layer between workflow output and delivery work. A case keeps
the reported outcome, current disposition, confidence, owner, due date, workflow runs, Work Items,
resolution, and append-only activity in one personal-workspace record.

Standalone workflows and Work Items remain supported. Users open a case when continuity and an
auditable decision trail are useful; they do not have to convert every prompt or task into a case.

## Personal workspace and members

Every existing and new `AppUser` receives one personal `Workspace`. Each workspace contains:

- one member linked to the authenticated workspace owner;
- five persisted sample members for operations, support, consulting, engineering, and quality.

Sample members are real database records and valid assignment targets. They remain visibly marked
as samples, cannot sign in, and cannot generate fictional activity. Events created by a person are
attributed to the authenticated `AppUser`; system and migration events are attributed to OpsPilot.
A later invitation flow can link or replace a sample profile without rewriting historical events.

## Case model

Each case receives a workspace-local human key such as `OPS-0001`. The state machine rejects
unsupported jumps and supports the following operating states:

```text
new → triaging → action-required → in-progress → monitoring → resolved → closed
         ↕              ↕              ↕             ↕           ↘
  needs-information ────┴──────────────┴─────────────┘          triaging
```

The exact allowed transitions are server-owned. Dispositions are:

- unclassified;
- product defect;
- configuration change;
- process guidance;
- external dependency;
- duplicate;
- needs more evidence.

Closing a resolved case preserves its resolution timestamp. Reopening a closed case clears the
closed timestamp while retaining the append-only history.

## Assignment and lineage

`CaseAssignment` stores the current case owner as a real `WorkspaceMember` relationship. Work Items
now use the same relationship instead of a free-form assignee string. The migration preserves every
legacy key: known sample keys link to their seeded members, while unknown keys become clearly named
imported collaborator records in the owner's workspace.

Workflow runs, handoffs, and Work Items have nullable case relationships. Expired workflow runs stay
hidden from case detail and are not copied into durable cases during historic backfill. A run
launched from a case retains that case ID; subsequent reviewed handoffs inherit it; a converted Work
Item retains the source run, handoff, case, assignee, and due date.

## API surface

All endpoints require the existing WorkOS Bearer boundary and enforce personal-workspace ownership:

```text
GET    /api/v1/workspace/members
GET    /api/v1/cases
POST   /api/v1/cases
GET    /api/v1/cases/{caseId}
PATCH  /api/v1/cases/{caseId}
PUT    /api/v1/cases/{caseId}/assignment
GET    /api/v1/work-items?caseId=&assigneeId=&status=
PATCH  /api/v1/work-items/{itemId}
```

Case listing supports bounded page sizes, pagination, search, state, disposition, and assignee
filters. Cross-workspace case and member identifiers return safe not-found or validation errors.

## Activity timeline

The case timeline records:

- creation;
- assignment and reassignment;
- state and disposition changes;
- linked workflow runs;
- Work Item creation and updates;
- resolution updates;
- system-owned historic backfill.

The events are designed as the future integration seam for Slack, Pumble, Linear, and opt-out email
notifications. This release does not deliver notifications or external messages; a later milestone
should add a transactional outbox and idempotent connector deliveries without changing case history.

## Deployment and rollback

Deploy the Django backend before the Next.js frontend. The normal Render build command applies the
new migrations and:

1. creates personal workspaces and seeded member records for existing accounts;
2. converts legacy Work Item assignee keys to foreign keys;
3. backfills a system-attributed case for unexpired historic Bug Triage runs and owner-valid linked
   handoffs and Work Items while preserving the source chronology.

No new environment variable, Redis service, worker, or cache is required. The migrations are
additive until the legacy assignee string is converted inside one migration transaction. Take the
normal PostgreSQL backup before production migration; rollback should restore that backup rather
than attempting to reverse the data conversion.

After the backend is healthy, deploy the frontend and smoke-test:

1. open a case;
2. assign and reassign a sample member;
3. run Bug Triage from the case;
4. create reviewed delivery work;
5. change Work Item state and owner;
6. confirm every change appears in the case timeline.
