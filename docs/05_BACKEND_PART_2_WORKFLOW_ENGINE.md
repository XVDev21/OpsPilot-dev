# 05 — Backend Part 2: Gemini Workflow Engine

## Objective

Complete all three live workflows through one stable Django API.

Stay synchronous for the hackathon.

Do not introduce Celery/Redis.

## Main endpoint

```text
POST /api/v1/workflows/{workflow_id}/runs
```

Lifecycle:

```text
authenticate
→ resolve workflow
→ validate input
→ create pending run
→ compile hidden prompt
→ invoke provider
→ validate output
→ persist
→ return
```

## Provider abstraction

Concept:

```python
class AIProvider(Protocol):
    def generate_structured(
        self,
        *,
        system_instruction: str,
        user_content: str,
        output_schema: type[BaseModel],
    ) -> ProviderResult:
        ...
```

Implement:

```text
GeminiProvider
```

Future OpenAI adapter should not require workflow-service redesign.

## Gemini

Use the current official supported Google Python SDK at implementation time.

Backend-only:

```text
GEMINI_API_KEY
GEMINI_MODEL
AI_REQUEST_TIMEOUT_SECONDS
```

Requirements:

- timeout
- structured output where supported
- safe provider errors
- no secret logging
- model response always server validated

## Prompt architecture

Normal user never sees RICO.

Each workflow has:

- system role
- accuracy/evidence guardrails
- input formatter
- output contract
- prompt version

Common rules:

- use provided input only
- do not invent names
- do not invent owners
- do not invent dates/deadlines
- do not invent technical facts
- identify missing information
- stay within requested artifact
- follow output schema

## Bug Triage output

```python
class BugTriageOutput(BaseModel):
    summary: str
    confirmedFacts: list[str]
    evidenceGaps: list[str]
    likelyCategory: str
    recommendedChecks: list[str]
    confidence: float  # 0.0 through 1.0
    humanReviewNotice: str
```

No guaranteed root-cause claims without evidence.

## Meeting Actions output

```python
class ActionItem(BaseModel):
    task: str
    owner: str | None
    deadline: str | None

class MeetingActionsOutput(BaseModel):
    summary: str
    decisions: list[str]
    actionItems: list[ActionItem]
    openQuestions: list[str]
    unresolvedItems: list[str]
```

Owner/deadline only when the notes support them.

## Status Update output

```python
class StatusUpdateOutput(BaseModel):
    completed: list[str]
    inProgress: list[str]
    blocked: list[str]
    nextSteps: list[str]
    shareableUpdate: str
```

Do not mark work completed if the notes say it is ongoing.

## Output validation

```text
provider structured data
→ Pydantic
→ accepted result
```

If invalid:

- one controlled repair attempt optional
- otherwise `INVALID_AI_OUTPUT`
- mark run failed
- never return malformed partial output as a successful run

## Provider error codes

Normalize:

```text
AI_AUTH_ERROR
AI_RATE_LIMITED
AI_TIMEOUT
AI_UNAVAILABLE
INVALID_AI_OUTPUT
AI_REQUEST_FAILED
```

Set retryable correctly.

## Run persistence

Before provider call:

```text
pending
```

Success:

- completed
- result
- provider
- model
- duration
- completed_at

Failure:

- failed
- safe error code

Store prompt version rather than exposing/storing the full hidden prompt when not necessary.

## Cost and abuse guardrails

Minimum:

- authentication required
- input length limits
- timeout
- no calls on keystrokes
- no silent infinite retries
- simple user throttling only if straightforward

## Tests

Mock Gemini in automated test suite.

Test:

- all three successful workflows
- unknown workflow
- bad input
- timeout
- rate limit
- malformed provider output
- completed run persistence
- failed run persistence
- ownership

Real provider smoke test is manual and excluded from CI.

## Contract rule

The camelCase response fields above are the versioned public API contract. The backend models,
frontend Zod schemas, shared JSON fixtures in `contracts/v1/`, and generated OpenAPI document must
change together. Internal Python services may use snake_case, but the API boundary must not drift.

## Completion

- 3 live workflows
- Gemini server-side
- Pydantic validation
- history
- safe errors
- auth
- tests
