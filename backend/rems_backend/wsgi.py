"""
WSGI config for rems_backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rems_backend.settings')

import django
django.setup()

from django.core.management import call_command
try:
    print("Running automatic startup migrations...")
    call_command('migrate', '--noinput')
    
    from django.contrib.auth import get_user_model
    User = get_user_model()
    if not User.objects.filter(email='admin@gmail.com').exists():
        User.objects.create_superuser('admin@gmail.com', 'admin@123', first_name='Admin', last_name='User')
        print("Default admin user created successfully.")
except Exception as e:
    print(f"Startup DB Initialization failed: {e}")

application = get_wsgi_application()

