from uuid import UUID

from django.db import transaction

from accounts.models import AppUser
from runs.selectors import run_for_user


@transaction.atomic
def delete_run(*, user: AppUser, run_id: UUID) -> None:
    run_for_user(user=user, run_id=run_id).delete()
