import os
import django
from datetime import datetime, date, time, timedelta
from django.utils import timezone
import pytz

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import User, Attendance, WorkSession, BreakSession, IdleLog
from core.services import AttendanceService
from core.serializers import AttendanceSerializer

def verify_serializer():
    ist = pytz.timezone('Asia/Kolkata')
    user = User.objects.filter(email='employee@rems.com').first()
    test_date = date(2026, 3, 2)
    Attendance.objects.filter(user=user, date=test_date).delete()
    att = Attendance.objects.create(user=user, date=test_date, status='absent')
    
    # 8h session
    start_dt = ist.localize(datetime.combine(test_date, time(9, 0)))
    end_dt = ist.localize(datetime.combine(test_date, time(17, 0)))
    ws = WorkSession.objects.create(attendance=att, start_time=start_dt, end_time=end_dt)
    
    # 1h break
    bs_start = ist.localize(datetime.combine(test_date, time(12, 0)))
    bs_end = ist.localize(datetime.combine(test_date, time(13, 0)))
    BreakSession.objects.create(work_session=ws, start_time=bs_start, end_time=bs_end)
    
    AttendanceService.recalculate_status(att)
    
    # Check Serializer
    serializer = AttendanceSerializer(att)
    data = serializer.data
    
    print(f"Serializer Verification (8h Gross, 1h Break):")
    print(f"  total_work_seconds: {data['total_work_seconds']} (Expected: 28800)")
    print(f"  total_break_seconds: {data['total_break_seconds']} (Expected: 3600)")
    print(f"  effective_work_seconds: {data['effective_work_seconds']} (Expected: 25200)")
    print(f"  work_hours (Productive): {data['work_hours']} (Expected: 7.0)")
    
    success = (data['total_work_seconds'] == 28800 and 
               data['total_break_seconds'] == 3600 and 
               data['effective_work_seconds'] == 25200)
               
    if success:
        print("SERIALIZER VERIFICATION PASSED.")
    else:
        print("SERIALIZER VERIFICATION FAILED.")
    
    Attendance.objects.filter(user=user, date=test_date).delete()

if __name__ == "__main__":
    verify_serializer()
