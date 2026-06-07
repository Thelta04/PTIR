#!/bin/bash
# scripts/images/create_bastion_vm.sh
# Creates a bastion VM using the pre-baked tuxy-bastion image

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/config.sh"

INSTANCE="${1:-bastion}"
IP="${2:-$BASTION_IP}"

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

echo "Creating Bastion VM '$INSTANCE' ($IP)"
gcloud compute instances create "$INSTANCE" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-micro \
    --image-family=tuxy-bastion \
    --private-network-ip="$IP" \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="$TAG_BASTION" \
    --address="$BASTION_STATIC_IP_NAME" \
    2>/dev/null || echo "VM '$INSTANCE' already exists."

echo "Bastion VM '$INSTANCE' created."
