FROM python:3.12-slim

WORKDIR /app

# Install system deps for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend_req.txt .
RUN pip install --no-cache-dir -r backend_req.txt && \
    pip install --no-cache-dir PyJWT gunicorn

# Copy project
COPY . .

# Collect static files for Django admin / DRF browsable API
RUN python manage.py collectstatic --noinput 2>/dev/null || true

EXPOSE 8000

CMD ["gunicorn", "core.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120"]
