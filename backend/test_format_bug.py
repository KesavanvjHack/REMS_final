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

url_exp_bad = 'http://127.0.0.1:8000/api/export/?type=attendance&format=csv'
resp1 = requests.get(url_exp_bad, headers=headers)
print('Bad URL (format=csv):', resp1.status_code)

url_exp_good = 'http://127.0.0.1:8000/api/export/?type=attendance&export_format=csv'
resp2 = requests.get(url_exp_good, headers=headers)
print('Good URL (export_format=csv):', resp2.status_code)
