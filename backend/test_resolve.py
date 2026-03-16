import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from django.urls import resolve

try:
    match = resolve('/api/export/')
    print("Resolved to:", match.func)
    print("View Name:", match.view_name)
    print("Namespace:", match.namespace)
    print("Route:", match.route)
except Exception as e:
    print("Resolution failed:", type(e), str(e))

print("--------------")
try:
    match2 = resolve('/api/auth/me/')
    print("Resolved /api/auth/me/ to:", match2.func)
except Exception as e:
    print("Resolution failed for /api/auth/me/:", type(e), str(e))
