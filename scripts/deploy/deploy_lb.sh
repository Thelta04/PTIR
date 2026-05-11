#!/bin/bash
# scripts/deploy/deploy_lb.sh
# Phase 3: Load Balancer Setup

set -e
set -o pipefail

# Load configuration and utilities
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/../.." && pwd)"
source "$DEPLOY_DIR/../common/config.sh"
source "$DEPLOY_DIR/../common/utils.sh"

# Dynamic Instance Discovery
echo "Discovering instances..."
LB_INSTANCES=$(get_instances_by_tag "$TAG_LB")
WEBAPP_INSTANCES=$(get_instances_by_tag "$TAG_WEB")

echo "Targets: LB ($LB_INSTANCES)"

# Get WebApp IPs for LB configuration
WEBAPP_IPS=""
for INSTANCE in $WEBAPP_INSTANCES; do
    IP=$(gcloud compute instances describe "$INSTANCE" \
        --project="$PROJECT_ID" --zone="$ZONE" \
        --format='get(networkInterfaces[0].networkIP)')
    WEBAPP_IPS+="$IP,"
done
WEBAPP_IPS=${WEBAPP_IPS%,} # Remove trailing comma

if [ -z "$WEBAPP_IPS" ]; then
    echo "ERROR: No WebApp instances found. Cannot configure Load Balancer."
    exit 1
fi

echo "--- Load Balancer Setup ---"

for LB_INSTANCE in $LB_INSTANCES; do
    echo ""
    echo "=================================================="
    echo "Updating Load Balancer: $LB_INSTANCE"
    echo "=================================================="

    # Determine Peer IP for Keepalived unicast
    if [[ "$LB_INSTANCE" == *"-01"* ]]; then
        PEER_NAME=$(echo $LB_INSTANCES | tr ' ' '\n' | grep -- "-02" | head -n 1)
    else
        PEER_NAME=$(echo $LB_INSTANCES | tr ' ' '\n' | grep -- "-01" | head -n 1)
    fi
    PEER_IP=$(gcloud compute instances describe "$PEER_NAME" --project="$PROJECT_ID" --zone="$ZONE" --format='get(networkInterfaces[0].networkIP)')

    remote_scp "$LB_INSTANCE" \
        "$DEPLOY_DIR/../setup/setup_lb.sh" \
        "$DEPLOY_DIR/../healthchecks/lb_healthcheck.sh" \
        "$DEPLOY_DIR/../common/config.sh" \
        "$DEPLOY_DIR/../common/utils.sh" \
        "$DEPLOY_DIR/../healthchecks/check_nginx.sh" \
        "$DEPLOY_DIR/../healthchecks/notify_master.sh" \
        "$ROOT_DIR/nginx/ssl/fullchain.pem" \
        "$ROOT_DIR/nginx/ssl/privkey.pem"

    remote_exec "$LB_INSTANCE" "
        set -e
        source /tmp/config.sh
        sudo mkdir -p \$TARGET_DIR/scripts
        sudo mv /tmp/setup_lb.sh /tmp/lb_healthcheck.sh /tmp/config.sh /tmp/utils.sh /tmp/check_nginx.sh /tmp/notify_master.sh \$TARGET_DIR/scripts/
        sudo chmod +x \$TARGET_DIR/scripts/setup_lb.sh \$TARGET_DIR/scripts/lb_healthcheck.sh \$TARGET_DIR/scripts/check_nginx.sh \$TARGET_DIR/scripts/notify_master.sh
        sudo \$TARGET_DIR/scripts/setup_lb.sh '$WEBAPP_IPS' '$PEER_IP'
    " || echo "WARNING: Failed to update LB $LB_INSTANCE"
done

echo "Load Balancer deployment successful!"
