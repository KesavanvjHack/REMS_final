import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import User, Attendance, WorkSession, BreakSession
from core.services import WorkSessionService, BreakSessionService, StatusService, AttendanceService

# Create dummy user
user, _ = User.objects.get_or_create(email="testbug@example.com", defaults={
    "first_name": "Test",
    "last_name": "Bug",
    "role": "employee"
})

# Mocking Request
class MockRequest:
    META = {}
    user = user

request = MockRequest()

print(f"Status before start: {StatusService.get_user_status(user)['status']}")

ws, _ = WorkSessionService.start_session(user, request)
print(f"Status after working: {StatusService.get_user_status(user)['status']}")

bs, _ = BreakSessionService.start_break(user)
print(f"Status after break start: {StatusService.get_user_status(user)['status']}")

import time
time.sleep(2)

BreakSessionService.stop_break(user)
print(f"Status after break stop: {StatusService.get_user_status(user)['status']}")

resuming_status = StatusService.get_user_status(user)
print(f"Final resolved status: {resuming_status['status']}")

# Cleanup
user.delete()
