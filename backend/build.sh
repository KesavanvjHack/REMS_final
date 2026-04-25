#!/usr/bin/env bash
# Render Build Script for REMS Backend
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --noinput
python manage.py migrate --noinput

# Automatically create a default admin user for testing
python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(email='admin@gmail.com').exists() or User.objects.create_superuser('admin@gmail.com', 'admin@123', first_name='Admin', last_name='User')"

