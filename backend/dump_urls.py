import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')
django.setup()

from django.urls import get_resolver

resolver = get_resolver()
for url in resolver.url_patterns:
    if hasattr(url, 'url_patterns'):
        for sub in url.url_patterns:
            print(f"[{url.pattern}] -> {sub.pattern}")
    else:
        print(url.pattern)
