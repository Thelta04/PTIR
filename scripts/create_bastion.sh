#!/bin/bash
# scripts/create_bastion.sh
# Creates the bastion (jump server) VM with a fixed internal IP and a static external IP.
# All SSH management of internal VMs must go through this bastion.
# Usage: ./create_bastion.sh

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/config.sh"
source "$SCRIPT_DIR/common/utils.sh"

INSTANCE="bastion"

# Reserve Static External IP (idempotent)
echo "Reserving static external IP '$BASTION_STATIC_IP_NAME'..."
gcloud compute addresses create "$BASTION_STATIC_IP_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --quiet 2>/dev/null || echo "Static IP '$BASTION_STATIC_IP_NAME' already exists."

BASTION_EXTERNAL_IP=$(gcloud compute addresses describe "$BASTION_STATIC_IP_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format='get(address)')
echo "Bastion external IP: $BASTION_EXTERNAL_IP"

# Create VM
echo ""
echo "Creating Bastion VM '$INSTANCE' ($BASTION_IP) ..."
gcloud compute instances create "$INSTANCE" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip="$BASTION_IP" \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="$TAG_BASTION" \
    --address="$BASTION_STATIC_IP_NAME" \
    2>/dev/null || echo "VM '$INSTANCE' already exists."

# Wait for SSH
echo ""
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

# Harden & Configure
echo ""
echo "--- Deploying bastion setup scripts ---"

remote_scp "$INSTANCE" \
    "$SCRIPT_DIR/setup/setup_bastion.sh" \
    "$SCRIPT_DIR/firewall/bastion-firewall-rules.sh"

remote_exec "$INSTANCE" "
    set -e
    chmod +x /tmp/setup_bastion.sh /tmp/bastion-firewall-rules.sh
    sudo /tmp/setup_bastion.sh
    sudo /tmp/bastion-firewall-rules.sh
" || { echo "ERROR: Failed to setup $INSTANCE"; exit 1; }

echo ""
echo "=========================================="
echo "  Internal IP : $BASTION_IP"
echo "  External IP : $BASTION_EXTERNAL_IP"
echo "=========================================="
echo ""
echo "Connect:  ssh $REMOTE_USER@$BASTION_EXTERNAL_IP"
echo "Tunnel:   ssh -J $REMOTE_USER@$BASTION_EXTERNAL_IP $REMOTE_USER@<internal-ip>"
