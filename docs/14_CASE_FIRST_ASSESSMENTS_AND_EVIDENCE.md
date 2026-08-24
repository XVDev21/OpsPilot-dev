# Case-first assessments and evidence

## Decision

Authenticated OpsPilot work begins in an Operations Case. The earlier workflow engine remains an
internal, versioned execution boundary and a compatibility surface for historic data; it is no
longer a parallel top-level product area.

The three case intents are user-owned and are not AI classifications:

- `issue` — investigate bug, settings, process, or insufficient evidence;
- `clarification` — request guidance while preserving the option to publish and assign;
- `enhancement` — additional development that does not run bug-versus-settings triage.

Publication is also independent from assessment:

- `draft` is private to the creator's personal workspace;
- `published` is ready for workspace delivery and assignment;
- `archived` is removed from active delivery without deleting history.

An AI result never publishes, assigns, resolves, closes, or suppresses a case. Assigning a member
requires a published case; the service atomically publishes an older draft when a legacy assignment
API is used.

## Durable data

`OperationsCase` now owns intent, publication state, affected area, expected outcome, environment,
known settings, constraints, publication attribution, and the existing delivery fields.

`CaseEvidence` stores workspace-scoped text or image records. Image uploads are limited, decoded by
Pillow, restricted to JPEG/PNG/WebP, dimension checked, orientation normalized, re-encoded to strip
embedded metadata, hashed, and served only through an authenticated content endpoint. SVG and other
active or ambiguous formats are rejected.

`CaseAssessment` is append-only per case and snapshots:

- sequence and source run;
- provider, exact model, intelligence tier, and prompt version;
- evidence identifiers, text/captions, MIME type, and image digest at assessment time;
- validated structured result;
- proposed disposition;
- model confidence and OpsPilot-derived decision confidence;
- confidence factors, band, and reviewed application state.

Applying an assessment updates only the working summary, disposition, and confidence. Earlier
assessment versions remain available and are never averaged or overwritten.

The dedicated assessment endpoint marks its workflow run as a case assessment and stores the
evidence snapshot on that run before provider execution. Generic compatibility runs can remain
linked to a case, but cannot create a formal `CaseAssessment`. Asynchronous local-connector
completion reads the immutable run snapshot rather than mutable current evidence.

## Confidence policy

The provider's bounded confidence is one input, not the decision. OpsPilot derives confidence from:

1. model confidence (55%);
2. evidence coverage across report, affected area, expected outcome, attached evidence, and
   environment/settings context (30%);
3. consistency after evidence gaps and contradictions (15%).

Missing evidence and three or more gaps apply deterministic caps. Bands are low below 0.50, medium
below 0.78, and high at or above 0.78. High confidence still requires human confirmation.

## Provider and model selection

The case page reads server-owned execution options and shows only configured providers. It displays
the exact tier model selected by server policy. Changing provider or model creates another
assessment and shows a comparison warning; switching does not inherently reduce accuracy.

Gemini is the only adapter currently advertised as verified for image evidence. OpenAI, Qwen,
Bedrock, governed compatible endpoints, and the local connector remain fully usable for text-only
case evidence. Their capability boundary is explicit so future multimodal adapters can be added
without changing the case or assessment contract.

## Private image storage

Development uses `backend/media`. Production should configure a private S3-compatible object store:

```text
CASE_EVIDENCE_S3_BUCKET
CASE_EVIDENCE_S3_REGION
CASE_EVIDENCE_S3_ENDPOINT_URL       # optional for AWS S3; required for R2/B2 equivalents
CASE_EVIDENCE_S3_ACCESS_KEY
CASE_EVIDENCE_S3_SECRET_KEY
```

The application never returns an object-store URL. Django reads the private object and streams it
through workspace authorization with `private, no-store` and `nosniff` response headers.

Evidence processing is capacity-bounded at every service boundary:

- authentication completes before the Next.js BFF parses multipart content;
- both BFF and Django ingress enforce the 8 MB file ceiling;
- images are limited to 10 megapixels and normalized output is rechecked;
- a personal workspace may store 200 evidence items and 512 MB by default;
- one multimodal assessment may analyze 8 images totaling 24 MB by default;
- quota changes are serialized on the workspace to prevent concurrent cross-case bypass.

Removing active evidence excludes it from future assessment input and deletes its backing image
object. Completed assessment snapshots remain append-only audit history; full account erasure
removes the owning personal workspace and its cases.

Render Free has no durable filesystem. Uploads can be exercised before object storage is configured,
but local Render files can disappear after a restart or deploy. Set the five variables above before
treating production image evidence as durable. Do not make the bucket public.

## Compatibility

- Existing cases migrate to `issue` and `published`, preserving creator and original timestamps.
- Existing workflow runs, handoffs, Work Items, and events are retained.
- Authenticated `/app/workflows` routes redirect to the case register; a legacy case query redirects
  to that case.
- Public deterministic Demo workflow routes remain available for the current showcase.
- The old workflow-run API remains authenticated for historic clients, while the new UI executes
  assessment through `/cases/{caseId}/assessments`.
- Meeting Actions and Status Update data remain readable. New authenticated intake does not launch
  either as a standalone workflow.

## Implemented PR 3 — Work Status collaboration

PR 3 builds on the case-first contract without restoring a top-level Workflows area:

1. append-only, idempotent `CaseUpdate` records capture authenticated progress, blockers,
   decisions, clarifications, resolutions, and verification;
2. text and private image updates share the evidence storage authorization and quota boundary;
3. workspace Work Status, My Assigned, Needs Attention, Verification, and Resolved views organize
   published delivery work;
4. role-aware assignee controls allow real linked contributors to update their assigned work while
   reserving publication, assignment, assessment, due-date, and evidence changes for managers;
5. existing Work Items remain in the database and compatibility API while presenting as Case Tasks
   inside the case control plane;
6. new delivery history lives in Case Activity and the top-level Work Items/History navigation is
   retired through compatibility redirects;
7. notification-ready domain events are durable, but do not send email or workspace messages yet;
8. Slack, Pumble, Linear, and email remain later human-controlled event consumers.

Issue drafts now place Evidence and Advisory Assessment in the primary decision workspace. Standard
publication uses the exact applied advisory as its immutable publication basis. An owner can publish
without one only through an explicit override that is captured in case activity. AI remains advisory:
it cannot publish, assign, resolve, verify, or send a case.

Resolution is a two-person-capable delivery step rather than an automatic close. A resolution update
moves the case to verification; a verification pass resolves it, and a failed check reopens active
delivery with the verification record preserved.

Sample members remain clearly fictional database records. They may be assigned, but they cannot sign
in, author updates, receive notifications, or generate simulated activity.

## Locked PR 4 plan — real workspace participation and notifications

PR 4 should make collaboration real for invited people before adding broad third-party automation:

1. introduce workspace invitation and membership lifecycle APIs using WorkOS identities, including
   pending, active, suspended, and removed states;
2. allow an owner to replace or link a sample profile to an invited real member without rewriting
   historical assignments or case events;
3. add role management for owner, operator, contributor, and viewer with last-owner and self-removal
   safety rules;
4. add default-on email preferences at workspace and personal levels, with per-event controls for
   assignment, blocker, mention, resolution, verification, and due-date changes;
5. consume `CaseDomainEvent` through an idempotent outbox dispatcher with retries, terminal failure
   state, and delivery audit records;
6. ship transactional assignment, blocker, and verification email templates plus authenticated deep
   links and unsubscribe/preference management;
7. add a Connections surface that reserves provider-neutral Slack, Pumble, and Linear destinations,
   scopes, and delivery policy without allowing AI to send or create external work autonomously;
8. keep all external delivery behind a human preview/confirm action and preserve external message or
   issue identifiers on the case timeline for retry-safe linking;
9. add integration, permission, retry, email-preference, accessibility, responsive-browser, and
   security regression coverage before deployment.

Slack, Pumble, and Linear OAuth/API implementations may be delivered in the following connector PR
once their app registrations and production redirect URLs exist. PR 4 must leave the schema and UI
ready for those connectors without requiring their credentials to merge.
