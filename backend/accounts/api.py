from ninja import Router

from accounts.schemas import AppUserSchema

router = Router(tags=["account"])


@router.get("/me", response=AppUserSchema, summary="Current authenticated user")
def current_user(request):
    return request.auth.user
