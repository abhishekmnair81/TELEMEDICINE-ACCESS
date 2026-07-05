#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== Running Database Migrations ==="
python manage.py migrate --noinput

echo "=== Collecting Static Files ==="
python manage.py collectstatic --noinput

# Start Celery worker in the background
if [ -n "$CELERY_BROKER_URL" ]; then
    echo "=== Starting Celery Worker ==="
    python -m celery -A medical_backend worker --loglevel=info --concurrency=1 &
    
    echo "=== Starting Celery Beat ==="
    python -m celery -A medical_backend beat --loglevel=info &
else
    echo "=== Skipping Celery: CELERY_BROKER_URL is not set ==="
fi

echo "=== Starting Daphne Server ==="
# Render dynamically passes the PORT environment variable; fallback to 8000 if not set
python -m daphne -b 0.0.0.0 -p ${PORT:-8000} medical_backend.asgi:application