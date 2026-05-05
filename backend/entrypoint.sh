#!/bin/bash
set -e
# Apply all Django-internal migrations (auth, sessions, etc.)
python manage.py migrate --fake api
python manage.py migrate

# Collect static files for Django admin / DRF browsable API if not done
python manage.py collectstatic --noinput || true

# Start Gunicorn (or whatever CMD is passed)
exec "$@"
