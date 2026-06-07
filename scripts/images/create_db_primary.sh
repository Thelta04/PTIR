#!/bin/bash
# scripts/images/create_db_vm.sh
# Creates a database VM using the pre-baked tuxy-db image

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/config.sh"

# Default to db-01 to avoid colliding with existing db-01/02, or allow parameter
INSTANCE="${1:-db-01}"
IP="${2:-10.10.10.30}"

echo "Creating Database VM '$INSTANCE' ($IP)"
gcloud compute instances create "$INSTANCE" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-small \
    --image-family=tuxy-db \
    --private-network-ip="$IP" \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="$TAG_DB" \
    --no-address \
    2>/dev/null || echo "VM '$INSTANCE' already exists."

echo "DB VM '$INSTANCE' created."
