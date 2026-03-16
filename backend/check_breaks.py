import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()
from core.models import BreakSession
print('Open Breaks Count:', BreakSession.objects.filter(end_time__isnull=True).count())
for b in BreakSession.objects.filter(end_time__isnull=True):
    print(f'Break {b.id} for work session {b.work_session_id}')
