from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.models import AppUser
from cases.services import ensure_personal_workspace


@receiver(post_save, sender=AppUser)
def provision_personal_workspace(sender, instance: AppUser, **kwargs) -> None:
    ensure_personal_workspace(instance)
