from django.conf import settings
from ninja import Router

from ai.providers.registry import provider_is_enabled
from workflows.registry import WORKFLOW_REGISTRY
from workflows.schemas import ExecutionOptions, WorkflowMetadata

router = Router(tags=["workflows"])


@router.get("/workflows", response=list[WorkflowMetadata], summary="Available workflows")
def list_workflows(request):
    return [workflow.metadata() for workflow in WORKFLOW_REGISTRY.values()]


@router.get(
    "/execution-options",
    response=ExecutionOptions,
    summary="Available AI execution options",
)
def execution_options(request):
    return {
        "providers": [
            {"id": "gemini", "label": "Gemini", "enabled": provider_is_enabled("gemini")},
            {"id": "openai", "label": "OpenAI", "enabled": provider_is_enabled("openai")},
        ],
        "intelligenceLevels": [
            {
                "id": "fast",
                "label": "Efficient",
                "description": "Lowest latency and token use for routine workflow jobs.",
                "relativeUsage": "lowest",
            },
            {
                "id": "balanced",
                "label": "Balanced",
                "description": "More reasoning depth with moderate token use.",
                "relativeUsage": "medium",
            },
            {
                "id": "high",
                "label": "Deep",
                "description": "Highest reasoning depth, token use, and expected latency.",
                "relativeUsage": "highest",
            },
        ],
        "defaultProvider": settings.AI_DEFAULT_PROVIDER,
        "defaultIntelligence": settings.AI_DEFAULT_INTELLIGENCE,
        "retentionDays": settings.WORKFLOW_RETENTION_DAYS,
    }
