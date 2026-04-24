#!/usr/bin/env bash
# Render Build Script for REMS Backend
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --noinput
python manage.py migrate --noinput
