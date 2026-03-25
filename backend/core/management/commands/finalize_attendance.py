from django.core.management.base import BaseCommand
from django.utils import timezone
from core.services import AttendanceService

class Command(BaseCommand):
    help = 'Finalizes attendance by auto-checking out sessions at shift end and sending pre-shift notifications.'

    def handle(self, *args, **options):
        now = timezone.localtime(timezone.now())
        self.stdout.write(f"[{now}] Running finalize_attendance...")

        # 1. Auto Checkout
        checkout_count = AttendanceService.auto_checkout_all_active_sessions()
        if checkout_count > 0:
            self.stdout.write(self.style.SUCCESS(f"Successfully auto-checked out {checkout_count} sessions."))
        else:
            self.stdout.write("No sessions required auto-checkout.")

        # 2. Pre-shift Notifications
        notif_count = AttendanceService.notify_upcoming_shifts()
        if notif_count > 0:
            self.stdout.write(self.style.SUCCESS(f"Sent {notif_count} pre-shift notifications."))
        else:
            self.stdout.write("No pre-shift notifications sent.")
