import os
import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from core.models import User
from rest_framework_simplejwt.tokens import RefreshToken

admin = User.objects.filter(role='admin').first()
token = str(RefreshToken.for_user(admin).access_token)
headers = {'Authorization': f'Bearer {token}'}

print("Testing /api/auth/me/")
url_me = 'http://127.0.0.1:8000/api/auth/me/'
print('Status:', requests.get(url_me, headers=headers).status_code)

print("\nTesting /api/export/")
url_exp = 'http://127.0.0.1:8000/api/export/?type=attendance&format=csv'
resp = requests.get(url_exp, headers=headers)
print('Status:', resp.status_code)
print('Text:', resp.text)
