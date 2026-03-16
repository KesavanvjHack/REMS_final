import os
import django
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import BreakSession, IdleLog

breaks = BreakSession.objects.filter(end_time__isnull=True)
count_b = breaks.count()
for b in breaks:
    b.end_time = timezone.now()
    b.save(update_fields=['end_time', 'updated_at'])

idles = IdleLog.objects.filter(end_time__isnull=True)
count_i = idles.count()
for i in idles:
    i.end_time = timezone.now()
    i.save(update_fields=['end_time', 'updated_at'])

print(f'Closed {count_b} orphaned breaks and {count_i} orphaned idles.')
