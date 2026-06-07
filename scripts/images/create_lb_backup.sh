#!/bin/bash
# scripts/images/create_lb_backup_vm.sh
# Creates a backup load balancer VM using the pre-baked tuxy-lb-backup image

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/config.sh"

# Default to lb-02 or allow parameter
INSTANCE="${1:-lb-02}"
IP="${2:-10.10.10.11}"

echo "Creating Backup Load Balancer VM '$INSTANCE' ($IP)"
gcloud compute instances create "$INSTANCE" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-micro \
    --image-family=tuxy-lb-backup \
    --private-network-ip="$IP" \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="http-server,https-server,$TAG_LB" \
    --no-address \
    2>/dev/null || echo "VM '$INSTANCE' already exists."

echo "Backup Load Balancer VM '$INSTANCE' created."
