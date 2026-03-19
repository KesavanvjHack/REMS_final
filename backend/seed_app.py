import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import User, AppUsageLog
import random
from datetime import timedelta
from django.utils import timezone

try:
    employee = User.objects.get(email='employee@rems.com')
    
    # Delete old logs for clean slate
    AppUsageLog.objects.filter(user=employee).delete()
    
    apps = [
        ('VSCode', 7200, 14400), # 2-4 hours
        ('GitHub', 1200, 3600), # 20m - 1h
        ('Slack', 1800, 3600), # 30m - 1h
        ('YouTube', 600, 1200), # 10m - 20m
        ('Notion', 1500, 5400), # 25m - 1.5h
        ('Figma', 2400, 7200), # 40m - 2h
        ('Twitter', 300, 900) # 5m - 15m
    ]
    
    now = timezone.now()
    
    for i, (app_name, min_dur, max_dur) in enumerate(apps):
        dur = random.randint(min_dur, max_dur)
        log = AppUsageLog.objects.create(
            user=employee,
            app_name=app_name,
            duration_seconds=dur,
        )
        # Update manually to bypass auto_now_add
        fake_time = now - timedelta(hours=i*2, minutes=random.randint(5, 45))
        AppUsageLog.objects.filter(id=log.id).update(timestamp=fake_time)
        
    print('Seed successful. Generated proper realistic AppUsageLogs.')
except Exception as e:
    print('Error:', e)
