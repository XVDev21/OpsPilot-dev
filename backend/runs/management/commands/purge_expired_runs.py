from django.core.management.base import BaseCommand
from django.utils import timezone

from runs.models import WorkflowRun


class Command(BaseCommand):
    help = "Permanently delete workflow runs whose retention period has elapsed."

    def handle(self, *args, **options):
        deleted, _ = WorkflowRun.objects.filter(expires_at__lte=timezone.now()).delete()
        self.stdout.write(self.style.SUCCESS(f"Purged {deleted} expired workflow run(s)."))
