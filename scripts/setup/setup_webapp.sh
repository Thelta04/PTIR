#!/bin/bash
# scripts/setup_webapp.sh
# Runs ON a webapp VM. Called by deploy.sh via gcloud SSH.

set -e
set -o pipefail

# Load utilities and config
[ -f /tmp/utils.sh ] && source /tmp/utils.sh
[ -f /tmp/config.sh ] && source /tmp/config.sh

TARGET_DIR="${1:-$TARGET_DIR}"
APP_USER="${2:-$REMOTE_USER}"
IS_FIRST_VM="$3"
INSTANCE_NAME="$4"

export DEBIAN_FRONTEND=noninteractive

echo "--- Setting up $INSTANCE_NAME ---"

# Ensure target directory exists
sudo mkdir -p "$TARGET_DIR"
sudo chown "$APP_USER:$APP_USER" "$TARGET_DIR"

# Install system dependencies
echo "Installing system dependencies..."
wait_for_dpkg_lock

sudo apt-get update -qq
sudo apt-get install -y python3-venv python3-pip curl nginx libpq-dev -qq

# Extract artifacts
echo "Extracting artifacts..."
tar -xzf /tmp/webapp_artifacts.tar.gz -C "$TARGET_DIR"

# Setup Backend
cd "$TARGET_DIR/backend"

# Recreate venv if missing or broken
CREATE_VENV=false
if [ ! -d "venv" ]; then
    CREATE_VENV=true
elif ! ./venv/bin/python -m pip --version >/dev/null 2>&1; then
    echo "Virtual environment exists but pip is broken. Recreating..."
    rm -rf venv
    CREATE_VENV=true
fi

if [ "$CREATE_VENV" = "true" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    if ! ./venv/bin/python -m pip --version >/dev/null 2>&1; then
        echo "Bootstrapping pip manually..."
        curl -sS https://bootstrap.pypa.io/get-pip.py | ./venv/bin/python
    fi
fi

echo "Installing Python dependencies..."
./venv/bin/python -m pip install --upgrade pip -q
./venv/bin/python -m pip install -r backend_req.txt -q

# Setup Gunicorn systemd service
cat <<EOF | sudo tee /etc/systemd/system/gunicorn.service
[Unit]
Description=gunicorn daemon
After=network.target

[Service]
User=$APP_USER
Group=www-data
WorkingDirectory=$TARGET_DIR/backend
EnvironmentFile=$TARGET_DIR/backend/.env
ExecStart=$TARGET_DIR/backend/venv/bin/gunicorn \\
          --workers 3 \\
          --bind 127.0.0.1:8001 \\
          core.wsgi:application

[Install]
WantedBy=multi-user.target
EOF

# Setup Nginx for webapp
cat <<'NGINXEOF' | sed "s|__TARGET_DIR__|$TARGET_DIR|g" | sudo tee /etc/nginx/sites-available/webapp
server {
    listen 8000;
    server_name _;

    location / {
        root __TARGET_DIR__/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
        add_header X-Served-By $hostname always;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header X-Served-By $hostname always;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /static/ {
        alias __TARGET_DIR__/backend/staticfiles/;
    }
}
NGINXEOF

sudo ln -sf /etc/nginx/sites-available/webapp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo systemctl daemon-reload

# First VM: run migrations and collectstatic
if [ "$IS_FIRST_VM" = "true" ]; then
    echo "Running migrations on $INSTANCE_NAME..."
    ./venv/bin/python manage.py makemigrations
    ./venv/bin/python manage.py migrate contenttypes
    ./venv/bin/python manage.py migrate auth
    ./venv/bin/python manage.py migrate admin
    ./venv/bin/python manage.py migrate sessions
    ./venv/bin/python manage.py migrate api --fake || true
    ./venv/bin/python manage.py migrate
    ./venv/bin/python manage.py collectstatic --noinput
fi

echo "Setting file permissions for nginx..."
chmod 755 "/home/$APP_USER"
chmod -R 755 "$TARGET_DIR/frontend/dist"

echo "Restarting gunicorn and nginx..."
sudo systemctl enable gunicorn
sudo systemctl restart gunicorn nginx

# Health check
echo "Running health check on $INSTANCE_NAME..."
SUCCESS=false
for i in $(seq 1 30); do
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/check/ 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "Health check PASSED on $INSTANCE_NAME (HTTP $HTTP_CODE)."
        SUCCESS=true
        break
    fi
    echo "  Waiting for service to be ready... ($i/30, HTTP $HTTP_CODE)"
    sleep 2
done

if [ "$SUCCESS" = "false" ]; then
    echo "ERROR: Health check FAILED on $INSTANCE_NAME!"
    exit 1
fi

echo "--- $INSTANCE_NAME deployment complete ---"
