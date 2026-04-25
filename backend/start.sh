#!/usr/bin/env bash
# Render Start Script for REMS Backend
set -o errexit

python manage.py migrate --noinput
python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(email='admin@gmail.com').exists() or User.objects.create_superuser('admin@gmail.com', 'admin@123', first_name='Admin', last_name='User')"
gunicorn rems_backend.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120
