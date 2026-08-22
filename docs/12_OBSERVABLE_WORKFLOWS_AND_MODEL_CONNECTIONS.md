# 12 — Observable Workflows, Model Connections, and Delivery Handoffs

## Delivered outcome

Live Mode now communicates real execution state and can route a completed Bug Triage result into
reviewed delivery work. OpsPilot also supports three additional connection patterns without exposing
private model servers or weakening the workflow contracts:

1. Amazon Bedrock through a personal regional bearer API key.
2. A governed public HTTPS OpenAI-compatible endpoint.
3. An outbound local connector for Ollama, LM Studio, vLLM, or another compatible private server.

## Execution lifecycle

Every run persists an `execution_phase`:

```text
queued → preparing → generating → validating → saving → completed
                                                        ↘ failed
```

Cloud calls remain synchronous for the current bounded hobby workload, while local runs return
`202 Accepted` and are polled from the browser. The interface shows a real elapsed timer and coarse
phase, not a fabricated percentage or completion estimate. A local job is leased for two minutes and
can be reclaimed after an expired lease, up to the bounded attempt policy.

## Local connector setup

From Settings, name the connector and map the three intelligence tiers to model IDs already
available on the local server. Generate the one-time command, then from `connector/`:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# Run the generated `opspilot_connector.py pair ...` command.
.\.venv\Scripts\python.exe opspilot_connector.py run
```

The default local model endpoint is `http://127.0.0.1:11434/v1`. `--api-key` supports local servers
that require a credential. The connector accepts only localhost or literal private IP model URLs,
polls a non-local OpsPilot deployment over outbound HTTPS, refuses redirects on both hops, and never
opens an inbound listener. Embedded URL credentials, query-string secrets, link-local/metadata
targets, unspecified addresses, and public model hosts are rejected before any request is made.

## Bedrock setup

In Settings, select Amazon Bedrock and provide:

- a Bedrock API key;
- the AWS Region containing the models;
- exact model or inference-profile IDs for Efficient, Balanced, and Deep.

The key must be authorized for `bedrock:InvokeModel`. Model availability varies by Region, so all
three mappings must be tested in the selected Region. AWS recommends short-term API keys for
production use; long-term keys are best reserved for exploration.

Official references:

- <https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html>
- <https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html>
- <https://docs.aws.amazon.com/bedrock/latest/userguide/endpoints.html>

## Triage-to-delivery flow

A completed Live Bug Triage exposes three explicit actions:

```text
Bug Triage result
├─ Create engineering / verification / investigation work item
├─ Send to Meeting Actions
└─ Add to Work Status
```

Each action creates an ownership-scoped editable draft. The user reviews the title, evidence,
ownership, due date, participants, or audience before conversion. Work Items persist on a personal
four-state board (`todo`, `in-progress`, `blocked`, `done`) and retain links to the originating run
and handoff. Fictional sample collaborators remain non-routable presentation data; this release does
not invite users, send notifications, or grant access.

## Deployment order

1. Deploy Django and apply migrations.
2. Confirm `/health`, WorkOS authentication, and existing Gemini Live Mode.
3. Deploy Next.js after the new API contracts are live.
4. Smoke-test one cloud connection and, from a user machine, one local connector run.
5. Verify the run phase, history entry, triage handoff, and Work Item state transition.

No Render worker, Redis, or new cache is required for the personal preview. PostgreSQL provides the
durable connector-job lease. Revisit a managed queue only after measured concurrency or long-running
work demonstrates the need.

## Security verification

The final diff scan reviewed all changed provider, connector, workflow, BFF, and work-item surfaces.
It identified one medium-severity redirect-following path in the custom OpenAI-compatible adapter.
The hosted adapter and local connector now use transports with redirects disabled, with regression
tests asserting the effective behavior. A production egress proxy or allowlist remains recommended
defense in depth when the hosting plan exposes that control.
