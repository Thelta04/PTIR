#!/bin/bash
# scripts/images/create_lb_vm.sh
# Creates a load balancer VM using the pre-baked tuxy-lb image

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/config.sh"

# Default to lb-01 or allow parameter
INSTANCE="${1:-lb-01}"
IP="${2:-10.10.10.10}"

echo "Creating Load Balancer VM '$INSTANCE' ($IP)"
gcloud compute instances create "$INSTANCE" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-micro \
    --image-family=tuxy-lb \
    --private-network-ip="$IP" \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --address="$STATIC_IP_NAME" \
    --tags="http-server,https-server,$TAG_LB" \
    2>/dev/null || echo "VM '$INSTANCE' already exists."

echo "Load Balancer VM '$INSTANCE' created"
