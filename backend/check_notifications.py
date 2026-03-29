import os
import django
from django.db.models import Q

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import Notification

def check_notifs():
    total = Notification.objects.filter(title__icontains='Shift Ended').count()
    print(f"Total 'Shift Ended' notifications: {total}")

if __name__ == "__main__":
    check_notifs()
