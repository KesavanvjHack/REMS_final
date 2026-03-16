import os
import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import User
from rest_framework_simplejwt.tokens import RefreshToken

admin = User.objects.filter(role='admin').first()
if not admin:
    print("NO ADMIN FOUND")
    exit()

token = str(RefreshToken.for_user(admin).access_token)

headers = {'Authorization': f'Bearer {token}'}
url = 'http://127.0.0.1:8000/api/export/?type=attendance&format=excel'
resp = requests.get(url, headers=headers)
print('Status:', resp.status_code)
if resp.status_code >= 400:
    print('Response:', resp.text)
else:
    print('Content-Type:', resp.headers.get('Content-Type'))
    print('Content-Disposition:', resp.headers.get('Content-Disposition'))
