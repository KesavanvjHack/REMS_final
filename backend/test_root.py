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

url_root = 'http://127.0.0.1:8000/api/'
resp = requests.get(url_root, headers=headers)
print('Root JSON:', resp.json())
