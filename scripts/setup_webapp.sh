#!/bin/bash
# scripts/setup_webapp.sh
# Usage: ./setup_webapp.sh [DB_HOST] [DB_NAME] [DB_USER] [DB_PASSWORD]

DB_HOST=${1:-"db-vm"}
DB_NAME=${2:-"tuxy_db"}
DB_USER=${3:-"tuxy_user"}
DB_PASSWORD=${4:-"tuxy_password"}

set -e
set -o pipefail
export DEBIAN_FRONTEND=noninteractive

# 1. Update and Install dependencies
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv nginx gunicorn libpq-dev curl

# 2. Setup Backend
mkdir -p /home/athen/app/backend
cd /home/athen/app/backend

# Recreate venv if it's missing or broken (can't run pip)
CREATE_VENV=false
if [ ! -d "venv" ]; then
    CREATE_VENV=true
elif ! ./venv/bin/python -m pip --version >/dev/null 2>&1; then
    echo "Virtual environment exists but pip is missing or broken. Recreating..."
    rm -rf venv
    CREATE_VENV=true
fi

if [ "$CREATE_VENV" = "true" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    # Bootstrap pip if missing (Debian/Ubuntu quirk)
    if ! ./venv/bin/python -m pip --version >/dev/null 2>&1; then
        echo "Pip not found in venv after creation, bootstrapping manually..."
        curl -sS https://bootstrap.pypa.io/get-pip.py | ./venv/bin/python
    fi
fi

source venv/bin/activate

# 3. Create .env file for backend
cat <<EOF > .env
DB_HOST=$DB_HOST
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DJANGO_ALLOWED_HOSTS=*
DJANGO_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
EOF

# 4. Setup Gunicorn Systemd Service
cat <<EOF | sudo tee /etc/systemd/system/gunicorn.service
[Unit]
Description=gunicorn daemon
After=network.target

[Service]
User=athen
Group=www-data
WorkingDirectory=/home/athen/app/backend
EnvironmentFile=/home/athen/app/backend/.env
ExecStart=/home/athen/app/backend/venv/bin/gunicorn \
          --workers 3 \
          --bind 127.0.0.1:8001 \
          core.wsgi:application

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable gunicorn

# 5. Setup Frontend directory
sudo mkdir -p /var/www/frontend
sudo chown athen:athen /var/www/frontend

# 6. Configure Nginx for WebApp VM
cat <<EOF | sudo tee /etc/nginx/sites-available/webapp
server {
    listen 8000;
    server_name _;

    location / {
        root /var/www/frontend;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /static/ {
        alias /home/athen/app/backend/staticfiles/;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/webapp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

echo "WebApp setup complete!"
