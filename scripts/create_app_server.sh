#!/bin/bash
# scripts/create_app_server.sh
# Creates a new app server instance, deploys the webapp (the LB healthche will automatically discover it)
# Usage: ./create_app_server.sh

set -e
set -o pipefail

# Load configuration and utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/config.sh"
source "$SCRIPT_DIR/common/utils.sh"

echo "Discovering existing webapp instances..."
WEBAPP_INSTANCES=$(get_instances_by_tag "$TAG_WEB")

if [ -z "$WEBAPP_INSTANCES" ]; then
    echo "No existing webapp VMs found. Creating web-1 at 10.10.10.20..."
    NEW_NUM=1
    NEW_IP="10.10.10.20"
else
    echo "Found existing webapp instances: $WEBAPP_INSTANCES"

    # Find the highest webapp IP and instance number
    MAX_SUFFIX=0
    MAX_NUM=0
    for INST in $WEBAPP_INSTANCES; do
        IP=$(gcloud compute instances describe "$INST" \
            --project="$PROJECT_ID" --zone="$ZONE" \
            --format='get(networkInterfaces[0].networkIP)')
        SUFFIX=${IP##*.}

        # Extract instance number from name (web-N)
        NUM=$(echo "$INST" | grep -oP '\d+$')

        if [ "$SUFFIX" -gt "$MAX_SUFFIX" ]; then
            MAX_SUFFIX=$SUFFIX
        fi
        if [ "$NUM" -gt "$MAX_NUM" ]; then
            MAX_NUM=$NUM
        fi

        echo "  $INST -> $IP"
    done

    NEW_SUFFIX=$((MAX_SUFFIX + 1))
    NEW_NUM=$((MAX_NUM + 1))
    NEW_IP="10.10.10.$NEW_SUFFIX"

    echo ""
    echo "Highest existing IP: 10.10.10.$MAX_SUFFIX"
fi

NEW_NAME="web-$NEW_NUM"
echo "Creating new webapp VM: $NEW_NAME ($NEW_IP)..."

gcloud compute instances create "$NEW_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-small \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip="$NEW_IP" \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="$TAG_WEB" \
    --no-address

echo ""
echo "VM '$NEW_NAME' created successfully with IP $NEW_IP"

# Wait for the new VM to be SSH-ready
echo ""
echo "Waiting for $NEW_NAME to be SSH-ready..."
for i in $(seq 1 30); do
    if gcloud compute ssh "$NEW_NAME" \
        --project="$PROJECT_ID" --zone="$ZONE" \
        --tunnel-through-iap \
        --command="echo ready" 2>/dev/null; then
        echo "$NEW_NAME is ready."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: Timed out waiting for $NEW_NAME SSH. Deploy manually."
        exit 1
    fi
    echo "  Attempt $i/30 - waiting..."
    sleep 10
done

# ============================================================
# PHASE: Build & Package Artifacts
# ============================================================
echo ""
echo "--- Building & Packaging Artifacts ---"

ROOT_DIR="$(cd "$SCRIPT_DIR/../" && pwd)"

echo "Building frontend..."
(cd "$ROOT_DIR/frontend" && npm install && npm run build)

echo "Packaging artifacts..."
cp "$ROOT_DIR/.env" "$ROOT_DIR/backend/.env"

# Dynamically discover all DB IPs for failover support
DB_INSTANCES=$(get_instances_by_tag "$TAG_DB")
DB_IPS=""
for INST in $DB_INSTANCES; do
    IP=$(gcloud compute instances describe "$INST" --project="$PROJECT_ID" --zone="$ZONE" --format='get(networkInterfaces[0].networkIP)')
    DB_IPS+="$IP,"
done
DB_IPS=${DB_IPS%,}
sed -i "s|^DB_HOST=.*|DB_HOST=$DB_IPS|" "$ROOT_DIR/backend/.env"

tar -czf /tmp/webapp_artifacts.tar.gz -C "$ROOT_DIR" --exclude='backend/venv' --exclude='__pycache__' backend/ frontend/dist/ scripts/ database/
rm "$ROOT_DIR/backend/.env"

# ============================================================
# PHASE: Deploy to New VM
# ============================================================
echo ""
echo "--- Deploying webapp to $NEW_NAME ---"

remote_scp "$NEW_NAME" \
    /tmp/webapp_artifacts.tar.gz \
    "$SCRIPT_DIR/common/config.sh" \
    "$SCRIPT_DIR/common/utils.sh" \
    "$SCRIPT_DIR/setup/setup_webapp.sh"

remote_exec "$NEW_NAME" "
    set -e
    chmod +x /tmp/setup_webapp.sh
    /tmp/setup_webapp.sh '$TARGET_DIR' '$REMOTE_USER' 'false' '$NEW_NAME'
" || { echo "ERROR: Deployment FAILED on $NEW_NAME. Scale-out incomplete!"; exit 1; }

# Cleanup local artifact
rm -f /tmp/webapp_artifacts.tar.gz

echo ""
echo "$NEW_NAME ($NEW_IP) is live."
