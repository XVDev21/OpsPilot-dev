from ninja import Router

from common.schemas import HealthResponse

router = Router(tags=["system"])


@router.get("/health", auth=None, response=HealthResponse, summary="Service health")
def health(request):
    return {"status": "ok", "service": "opspilot-api", "version": "v1"}
