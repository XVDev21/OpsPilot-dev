from django.db import DatabaseError, connection
from ninja import Router, Status

from common.schemas import HealthResponse, ReadinessResponse

router = Router(tags=["system"])


@router.get("/health", auth=None, response=HealthResponse, summary="Service health")
def health(request):
    return {"status": "ok", "service": "opspilot-api", "version": "v1"}


@router.get(
    "/health/ready",
    auth=None,
    response={200: ReadinessResponse, 503: ReadinessResponse},
    summary="Database readiness",
)
def readiness(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        return Status(
            503,
            {
                "status": "unavailable",
                "service": "opspilot-api",
                "version": "v1",
                "database": "unavailable",
            },
        )

    return {
        "status": "ready",
        "service": "opspilot-api",
        "version": "v1",
        "database": "ok",
    }
