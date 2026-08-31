from django.core.management.base import BaseCommand

from cases.notifications import opportunistic_dispatch


class Command(BaseCommand):
    help = "Dispatch pending OpsPilot notification emails from the durable outbox."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options) -> None:
        limit = max(0, min(options["limit"], 1_000))
        sent = opportunistic_dispatch(limit=limit)
        self.stdout.write(self.style.SUCCESS(f"Processed {sent} notification deliveries."))
