from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from accounts.models import AppUser
from cases.models import CaseEvidence, CaseUpdateAttachment, Workspace, WorkspaceMember
from cases.notifications import ensure_notification_defaults
from cases.services import ensure_personal_workspace


@receiver(post_save, sender=AppUser)
def provision_personal_workspace(sender, instance: AppUser, **kwargs) -> None:
    ensure_personal_workspace(instance)


@receiver(post_save, sender=Workspace)
def provision_workspace_notification_policy(sender, instance: Workspace, **kwargs) -> None:
    from cases.models import WorkspaceNotificationPolicy

    WorkspaceNotificationPolicy.objects.get_or_create(workspace=instance)


@receiver(post_save, sender=WorkspaceMember)
def provision_member_notification_preferences(
    sender,
    instance: WorkspaceMember,
    **kwargs,
) -> None:
    ensure_notification_defaults(member=instance)


@receiver(post_delete, sender=CaseEvidence)
def delete_case_evidence_file(sender, instance: CaseEvidence, **kwargs) -> None:
    if instance.file:
        storage = instance.file.storage
        name = instance.file.name
        transaction.on_commit(lambda: storage.delete(name))


@receiver(post_delete, sender=CaseUpdateAttachment)
def delete_case_update_attachment_file(
    sender,
    instance: CaseUpdateAttachment,
    **kwargs,
) -> None:
    if instance.file:
        storage = instance.file.storage
        name = instance.file.name
        transaction.on_commit(lambda: storage.delete(name))
