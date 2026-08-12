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
    confirmed_facts: list[str]
    evidence_gaps: list[str]
    likely_category: Literal[
        "configuration",
        "source_data",
        "calculation_or_logic",
        "display_or_reporting",
        "integration",
        "insufficient_evidence",
    ]
    recommended_checks: list[str]
    confidence: Literal["low", "medium", "high"]
    human_review_required: Literal[True]
```

No guaranteed root-cause claims without evidence.

## Meeting Actions output

```python
class ActionItem(BaseModel):
    action: str
    owner: str | None
    deadline: str | None

class MeetingActionsOutput(BaseModel):
    summary: str
    decisions: list[str]
    action_items: list[ActionItem]
    open_questions: list[str]
    unresolved_items: list[str]
```

Owner/deadline only when the notes support them.

## Status Update output

```python
class StatusUpdateOutput(BaseModel):
    completed: list[str]
    in_progress: list[str]
    blocked_or_waiting: list[str]
    next_steps: list[str]
    shareable_update: str
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

## Completion

- 3 live workflows
- Gemini server-side
- Pydantic validation
- history
- safe errors
- auth
- tests
