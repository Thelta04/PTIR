#!/bin/bash
# scripts/create_lb.sh
# Creates and starts the primary load balancer (lb-01) with the static public IP.
# Usage: ./create_lb.sh

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/common/config.sh"
source "$SCRIPT_DIR/common/utils.sh"

INSTANCE="lb-01"

# Create VM if it doesn't exist
echo "Creating Primary Load Balancer VM ($LB_PRIMARY_IP)..."
gcloud compute instances create "$INSTANCE" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip="$LB_PRIMARY_IP" \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="http-server,$TAG_LB" \
    --address="$STATIC_IP_NAME" \
    2>/dev/null || echo "VM '$INSTANCE' already exists."

# Wait for SSH
echo "Waiting for $INSTANCE to be SSH-ready..."
for i in $(seq 1 30); do
    if remote_exec "$INSTANCE" "echo ready" 2>/dev/null; then
        echo "$INSTANCE is ready."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: Timed out waiting for SSH on $INSTANCE."
        exit 1
    fi
    echo "  Attempt $i/30 - waiting..."
    sleep 10
done

# Discover webapp IPs for LB upstream config
echo "Discovering webapp instances..."
WEBAPP_INSTANCES=$(get_instances_by_tag "$TAG_WEB")
WEBAPP_IPS=""
for WEB_INST in $WEBAPP_INSTANCES; do
    IP=$(gcloud compute instances describe "$WEB_INST" \
        --project="$PROJECT_ID" --zone="$ZONE" \
        --format='get(networkInterfaces[0].networkIP)')
    WEBAPP_IPS+="$IP,"
done
WEBAPP_IPS=${WEBAPP_IPS%,}

if [ -z "$WEBAPP_IPS" ]; then
    echo "WARNING: No WebApp instances found. LB will have no upstreams."
fi

# Deploy LB configuration
echo "Deploying load balancer configuration on $INSTANCE..."

remote_scp "$INSTANCE" \
    "$SCRIPT_DIR/setup/setup_lb.sh" \
    "$SCRIPT_DIR/healthchecks/lb_healthcheck.sh" \
    "$SCRIPT_DIR/common/config.sh" \
    "$SCRIPT_DIR/common/utils.sh" \
    "$SCRIPT_DIR/healthchecks/check_nginx.sh" \
    "$SCRIPT_DIR/healthchecks/notify_master.sh" \
    "$ROOT_DIR/nginx/ssl/fullchain.pem" \
    "$ROOT_DIR/nginx/ssl/privkey.pem"

remote_exec "$INSTANCE" "
    set -e
    source /tmp/config.sh
    sudo mkdir -p \$TARGET_DIR/scripts
    sudo mv /tmp/setup_lb.sh /tmp/lb_healthcheck.sh /tmp/config.sh /tmp/utils.sh /tmp/check_nginx.sh /tmp/notify_master.sh \$TARGET_DIR/scripts/
    sudo chmod +x \$TARGET_DIR/scripts/setup_lb.sh \$TARGET_DIR/scripts/lb_healthcheck.sh \$TARGET_DIR/scripts/check_nginx.sh \$TARGET_DIR/scripts/notify_master.sh
    sudo \$TARGET_DIR/scripts/setup_lb.sh '$WEBAPP_IPS' '$LB_BACKUP_IP'
" || { echo "ERROR: Failed to setup $INSTANCE"; exit 1; }

echo ""
echo "Primary load balancer '$INSTANCE' ($LB_PRIMARY_IP) is running with public IP $EXTERNAL_IP."
