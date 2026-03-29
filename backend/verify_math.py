import os
import django
from datetime import datetime, date, time, timedelta
from django.utils import timezone
import pytz

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import User, Attendance, WorkSession, BreakSession, IdleLog, AttendancePolicy
from core.services import AttendanceService

def verify_math():
    ist = pytz.timezone('Asia/Kolkata')
    
    # 1. Use Existing User
    user = User.objects.filter(email='employee@rems.com').first()
    if not user:
        print("Required user employee@rems.com not found!")
        return
    
    # 2. Setup Attendance for a fixed day in the past to avoid conflict with today
    test_date = date(2026, 3, 1)
    Attendance.objects.filter(user=user, date=test_date).delete()
    att = Attendance.objects.create(user=user, date=test_date, status='absent')
    
    # 3. Create Work Session: 09:00 to 17:00 (8 hours = 28800s)
    start_dt = ist.localize(datetime.combine(test_date, time(9, 0)))
    end_dt = ist.localize(datetime.combine(test_date, time(17, 0)))
    
    ws = WorkSession.objects.create(
        attendance=att,
        start_time=start_dt,
        end_time=end_dt
    )
    
    # 4. Add Break: 12:00 to 13:00 (1 hour = 3600s)
    bs_start = ist.localize(datetime.combine(test_date, time(12, 0)))
    bs_end = ist.localize(datetime.combine(test_date, time(13, 0)))
    BreakSession.objects.create(work_session=ws, start_time=bs_start, end_time=bs_end)
    
    # 5. Add Idle: 15:00 to 15:30 (30 mins = 1800s)
    il_start = ist.localize(datetime.combine(test_date, time(15, 0)))
    il_end = ist.localize(datetime.combine(test_date, time(15, 30)))
    IdleLog.objects.create(work_session=ws, start_time=il_start, end_time=il_end)
    
    # 6. Recalculate
    AttendanceService.recalculate_status(att)
    att.refresh_from_db()
    
    total_work = att.total_work_seconds
    total_break = att.total_break_seconds
    total_idle = att.total_idle_seconds
    # Access as property
    effective = att.effective_work_seconds
    
    print(f"Calculation Results for 8h Login (9am-5pm) with 1h Break and 30m Idle:")
    print(f"  Total Work Session Duration: {total_work}s (Expected: 28800)")
    print(f"  Total Break Duration: {total_break}s (Expected: 3600)")
    print(f"  Total Idle Duration: {total_idle}s (Expected: 1800)")
    print(f"  Effective Productive Time: {effective}s (Expected: 23400)")
    print(f"  Calculated Status: {att.status} (Total Work Hours: {total_work/3600:.2f}h)")
    
    success = (total_work == 28800 and 
               total_break == 3600 and 
               total_idle == 1800 and 
               effective == 23400)
               
    if success:
        print("MATH VERIFICATION PASSED.")
    else:
        print("MATH VERIFICATION FAILED.")
    
    # Cleanup
    Attendance.objects.filter(user=user, date=test_date).delete()

if __name__ == "__main__":
    verify_math()
