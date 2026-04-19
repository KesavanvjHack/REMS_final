import os
import django
from datetime import datetime, date, time, timedelta
from django.utils import timezone
import pytz

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import User, Attendance, WorkSession, BreakSession, IdleLog

def debug_priya():
    user = User.objects.filter(email='employee@rems.com').first()
    today = date(2026, 4, 18)
    att = Attendance.objects.filter(user=user, date=today).first()
    
    if not att:
        print("No attendance for Priya today.")
        return

    print(f"Attendance Record: {att.id}")
    print(f"  Status: {att.status}")
    print(f"  Total Work (Gross): {att.total_work_seconds} ({timedelta(seconds=att.total_work_seconds)})")
    print(f"  Total Break: {att.total_break_seconds} ({timedelta(seconds=att.total_break_seconds)})")
    print(f"  Total Idle: {att.total_idle_seconds} ({timedelta(seconds=att.total_idle_seconds)})")
    print(f"  Effective: {att.effective_work_seconds} ({timedelta(seconds=att.effective_work_seconds)})")
    
    sessions = att.work_sessions.all().order_by('start_time')
    print(f"\nWork Sessions ({sessions.count()}):")
    for ws in sessions:
        duration = (ws.end_time - ws.start_time).total_seconds() if ws.end_time else "OPEN"
        print(f"  ID: {ws.id}")
        print(f"    Start: {ws.start_time}")
        print(f"    End:   {ws.end_time}")
        print(f"    Duration: {duration}")
        
        breaks = ws.break_sessions.all()
        if breaks:
            print(f"    Breaks ({breaks.count()}):")
            for b in breaks:
                dur = (b.end_time - b.start_time).total_seconds() if b.end_time else "OPEN"
                print(f"      {b.start_time} to {b.end_time} ({dur}s)")
        
        idles = ws.idle_logs.all()
        if idles:
            print(f"    Idle Logs ({idles.count()}):")
            for i in idles:
                dur = (i.end_time - i.start_time).total_seconds() if i.end_time else "OPEN"
                print(f"      {i.start_time} to {i.end_time} ({dur}s)")

if __name__ == "__main__":
    debug_priya()
