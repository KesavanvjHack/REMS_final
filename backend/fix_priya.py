import os
import django
from datetime import datetime, date, time, timedelta
from django.utils import timezone
import pytz

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import User, Attendance, WorkSession, IdleLog
from core.services import AttendanceService

def fix_priya():
    user = User.objects.filter(email='employee@rems.com').first()
    today = date(2026, 4, 18)
    att = Attendance.objects.filter(user=user, date=today).first()
    
    if not att:
        print("No attendance for Priya today.")
        return

    # Find the rogue idle log (ending after 3 PM UTC / 8:30 PM IST)
    # The debug logs showed it at 15:34 UTC
    rogue_idle = IdleLog.objects.filter(
        work_session__attendance=att,
        end_time__isnull=False,
        end_time__gt=timezone.now().replace(hour=12, minute=30, second=0, microsecond=0) # roughly after 6pm IST
    ).first()

    if rogue_idle:
        ws = rogue_idle.work_session
        print(f"Fixing Idle Log {rogue_idle.id}")
        print(f"  Old End: {rogue_idle.end_time}")
        print(f"  New End: {ws.end_time}")
        rogue_idle.end_time = ws.end_time
        rogue_idle.save()
        
        # Recalculate Attendance
        AttendanceService.recalculate_status(att)
        print("Priya's record RECALCULATED.")
    else:
        print("No rogue idle log found (maybe already fixed?)")

if __name__ == "__main__":
    fix_priya()
