import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from core.models import User
from core.views import WorkSessionView, BreakSessionView, RealTimeStatusView

user, _ = User.objects.get_or_create(email="apibug@example.com", defaults={
    "first_name": "API",
    "last_name": "Bug",
    "role": "employee"
})
factory = APIRequestFactory()

def print_status():
    req = factory.get('/api/status/me/')
    force_authenticate(req, user=user)
    view = RealTimeStatusView.as_view()
    res = view(req)
    print(f"Status: {res.data['status']}")

print("--- Starting Work ---")
req = factory.post('/api/sessions/work/', {'action': 'start'}, format='json')
force_authenticate(req, user=user)
view = WorkSessionView.as_view()
res = view(req)
print(res.status_code, res.data.get('status'))

print_status()

print("--- Starting Break ---")
req = factory.post('/api/sessions/break/', {'action': 'start'}, format='json')
force_authenticate(req, user=user)
view = BreakSessionView.as_view()
res = view(req)
print(res.status_code, res.data.get('status'))

print_status()

print("--- Stopping Break ---")
req = factory.post('/api/sessions/break/', {'action': 'stop'}, format='json')
force_authenticate(req, user=user)
res = view(req)
print(res.status_code, res.data.get('status'))

print_status()

print("--- Calling status via RealTimeStatusView ---")
print_status()

user.delete()
