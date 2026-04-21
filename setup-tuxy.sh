#!/bin/bash

# ==============================================================================
# TUXY - SETUP & DEPLOYMENT SCRIPT (Clean VM)
# ==============================================================================
# This script prepares a clean Debian/Ubuntu VM to run the TUXY application.
# It installs Docker, clones the repo, and starts the desired services.

set -e

REPO_URL="git@github.com:YOUR_USERNAME/YOUR_REPO.git" # <--- UPDATE THIS
PROJECT_DIR="$HOME/tuxy"

echo "--------------------------------------------------------"
echo "🚀 Starting TUXY Setup on $(hostname)"
echo "--------------------------------------------------------"

# 1. Update System
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Basic Dependencies
echo "🛠 Installing dependencies (Git, Curl, Docker libs)..."
sudo apt-get install -y ca-certificates curl gnupg lsb-release git

# 3. Setup Docker Repository
echo "🐳 Configuring Docker repository..."
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Configure User Permissions
echo "👤 Configuring user permissions for Docker..."
CURRENT_USER=$(whoami)
sudo usermod -aG docker $CURRENT_USER
echo "⚠️ Note: You might need to log out and back in for Docker group changes to take effect."

# 6. Authenticate in Artifact Registry (Lightweight Method)
echo "🔐 Authenticating with Google Artifact Registry (Metadata Server)..."
TOKEN=$(curl -s -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" | grep -oP '"access_token":"\K[^"]+')
echo "$TOKEN" | docker login -u oauth2accesstoken --password-stdin https://europe-southwest1-docker.pkg.dev

# 7. Clone Repository
if [ ! -d "$PROJECT_DIR" ]; then
    echo "📂 Repository not found. Cloning..."
    # Check if SSH key exists, if not, help the user
    if [ ! -f "$HOME/.ssh/id_ed25519" ]; then
        echo "🔑 No SSH key found. Generating one..."
        ssh-keygen -t ed25519 -C "tuxy-vm-key" -N "" -f "$HOME/.ssh/id_ed25519"
        echo "--------------------------------------------------------"
        echo "COPY THIS PUBLIC KEY TO GITHUB (Settings > Deploy Keys):"
        cat "$HOME/.ssh/id_ed25519.pub"
        echo "--------------------------------------------------------"
        read -p "Press [Enter] once you have added the key to GitHub..."
    fi
    git clone "$REPO_URL" "$PROJECT_DIR"
else
    echo "📂 Repository already exists. Pulling latest changes..."
    cd "$PROJECT_DIR"
    git pull
fi

cd "$PROJECT_DIR"

# 8. Setup .env file
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    touch .env
    echo "⚠️ .env created. Please add your credentials if needed."
fi

# 9. Choose Deployment Mode
echo "--------------------------------------------------------"
echo "Select Deployment Mode for this VM:"
echo "1) Full App (All services)"
echo "2) Application Server (Backend + Frontend)"
echo "3) Database Server (PostgreSQL)"
echo "4) Load Balancer (HAProxy)"
echo "--------------------------------------------------------"
read -p "Enter choice [1-4]: " CHOICE

case $CHOICE in
    1)
        echo "🚀 Starting ALL services..."
        docker compose -f docker-compose.prod.yml up -d
        ;;
    2)
        echo "🚀 Starting Backend and Frontend..."
        docker compose -f docker-compose.prod.yml up backend nginx -d
        ;;
    3)
        echo "🚀 Starting Database..."
        docker compose up db -d
        ;;
    4)
        echo "🚀 Starting Load Balancer (HAProxy)..."
        # Assuming you have the haproxy.cfg in the root
        docker run -d --name haproxy -p 80:80 -p 443:443 \
            -v $(pwd)/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro \
            haproxy:2.8
        ;;
    *)
        echo "❌ Invalid choice. Setup complete but no services started."
        ;;
esac

echo "✅ Setup TUXY completo em $(date)" > setup_status.txt
echo "🎉 Done! Check status with: docker ps"
