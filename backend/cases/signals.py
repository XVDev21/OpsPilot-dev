from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from accounts.models import AppUser
from cases.models import CaseEvidence
from cases.services import ensure_personal_workspace


@receiver(post_save, sender=AppUser)
def provision_personal_workspace(sender, instance: AppUser, **kwargs) -> None:
    ensure_personal_workspace(instance)


@receiver(post_delete, sender=CaseEvidence)
def delete_case_evidence_file(sender, instance: CaseEvidence, **kwargs) -> None:
    if instance.file:
        storage = instance.file.storage
        name = instance.file.name
        transaction.on_commit(lambda: storage.delete(name))
