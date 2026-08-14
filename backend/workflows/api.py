from ninja import Router

from workflows.registry import WORKFLOW_REGISTRY
from workflows.schemas import WorkflowMetadata

router = Router(tags=["workflows"])


@router.get("/workflows", response=list[WorkflowMetadata], summary="Available workflows")
def list_workflows(request):
    return [workflow.metadata() for workflow in WORKFLOW_REGISTRY.values()]
