import os
import django
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import WorkSession

sessions = WorkSession.objects.filter(end_time__isnull=True)
count = sessions.count()
for s in sessions:
    s.end_time = timezone.now()
    s.save(update_fields=['end_time', 'updated_at'])

print(f'Closed {count} orphaned work sessions.')
