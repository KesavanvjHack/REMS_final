import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from django.test import RequestFactory
from core.views import ExportView
from core.models import User

factory = RequestFactory()
admin = User.objects.filter(role='admin').first()
view = ExportView.as_view()

for exp_type in ['attendance', 'leave', 'audit', 'payroll']:
    for fmt in ['csv', 'excel']:
        try:
            request = factory.get(f'/api/export/?type={exp_type}&format={fmt}')
            request.user = admin
            response = view(request)
            print(f"[{exp_type} - {fmt}] Status: {response.status_code}")
            if response.status_code == 500:
                print(f"Failed {exp_type} {fmt}")
        except Exception as e:
            print(f"Exception on {exp_type} {fmt}:")
            traceback.print_exc()
