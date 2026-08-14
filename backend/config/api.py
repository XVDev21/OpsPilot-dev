from django.conf import settings
from ninja import NinjaAPI

from accounts.api import router as accounts_router
from common.api import router as common_router
from common.auth import workos_bearer
from common.errors import register_error_handlers
from runs.api import router as runs_router
from workflows.api import router as workflows_router

api = NinjaAPI(
    title="OpsPilot API",
    version="1.0.0",
    description="Authenticated workflow execution and run history for OpsPilot.",
    auth=workos_bearer,
    docs_url="/docs" if settings.DEBUG else None,
    openapi_url="/openapi.json",
)

register_error_handlers(api)
api.add_router("", common_router)
api.add_router("", accounts_router)
api.add_router("", workflows_router)
api.add_router("", runs_router)
