#!/bin/bash
# scripts/deploy/deploy_webapp.sh
# Phase 0: Build & Package, Phase 2: WebApp Deployment

set -e
set -o pipefail

# Load configuration and utilities
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/../.." && pwd)"
source "$DEPLOY_DIR/../common/config.sh"
source "$DEPLOY_DIR/../common/utils.sh"

# Dynamic Instance Discovery
echo "Discovering webapp instances..."
WEBAPP_INSTANCES=$(get_instances_by_tag "$TAG_WEB")
DB_INSTANCES=$(get_instances_by_tag "$TAG_DB")

echo "Targets: Web ($WEBAPP_INSTANCES)"

# ============================================================
# PHASE 0: Build Frontend Locally & Package Artifacts
# ============================================================
echo ""
echo "--- Phase 0: Build & Package ---"

echo "Building frontend..."
(cd "$ROOT_DIR/frontend" && npm install && npm run build)

echo "Packaging artifacts..."
cp "$ROOT_DIR/.env" "$ROOT_DIR/backend/.env"

# Dynamically discover all DB IPs for failover support
DB_IPS=""
for INST in $DB_INSTANCES; do
    IP=$(gcloud compute instances describe "$INST" --project="$PROJECT_ID" --zone="$ZONE" --format='get(networkInterfaces[0].networkIP)')
    DB_IPS+="$IP,"
done
DB_IPS=${DB_IPS%,}
sed -i "s|^DB_HOST=.*|DB_HOST=$DB_IPS|" "$ROOT_DIR/backend/.env"

# We package the whole scripts/ dir for now to maintain internal relative paths if needed on remote
tar -czf /tmp/webapp_artifacts.tar.gz -C "$ROOT_DIR" --exclude='backend/venv' --exclude='__pycache__' backend/ frontend/dist/ scripts/ database/
rm "$ROOT_DIR/backend/.env"

# ============================================================
# PHASE 2: Rolling Update for WebApp VMs
# ============================================================
echo ""
echo "--- Phase 2: WebApp Deployment (Rolling) ---"

FIRST_VM=true
WEBAPP_IPS=""

for INSTANCE in $WEBAPP_INSTANCES; do
    echo ""
    echo "=================================================="
    echo "Deploying to $INSTANCE..."
    echo "=================================================="

    IP=$(gcloud compute instances describe "$INSTANCE" \
        --project="$PROJECT_ID" --zone="$ZONE" \
        --format='get(networkInterfaces[0].networkIP)')
    WEBAPP_IPS+="$IP,"

    remote_scp "$INSTANCE" \
        /tmp/webapp_artifacts.tar.gz \
        "$DEPLOY_DIR/../common/config.sh" \
        "$DEPLOY_DIR/../common/utils.sh" \
        "$DEPLOY_DIR/../setup/setup_webapp.sh"

    remote_exec "$INSTANCE" "
        set -e
        chmod +x /tmp/setup_webapp.sh
        /tmp/setup_webapp.sh '$TARGET_DIR' '$REMOTE_USER' '$FIRST_VM' '$INSTANCE'
    " || { echo "ERROR: Deployment FAILED on $INSTANCE. Aborting rolling update"; exit 1; }

    FIRST_VM=false
done

# Cleanup local artifact
rm -f /tmp/webapp_artifacts.tar.gz

echo "WebApp deployment successful"
echo "WEBAPP_IPS=$WEBAPP_IPS" # Useful for LB deployment if run manually
