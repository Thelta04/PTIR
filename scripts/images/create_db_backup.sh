#!/bin/bash
# scripts/images/create_db_backup_vm.sh
# Creates a backup database VM using the pre-baked tuxy-db-backup image

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/config.sh"

# Default to db-02 to avoid colliding with existing db-01/02, or allow parameter
INSTANCE="${1:-db-02}"
IP="${2:-10.10.10.31}"

echo "Creating Backup Database VM '$INSTANCE' ($IP)"
gcloud compute instances create "$INSTANCE" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-small \
    --image-family=tuxy-db-backup \
    --private-network-ip="$IP" \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="$TAG_DB" \
    --no-address \
    2>/dev/null || echo "VM '$INSTANCE' already exists."

echo "Backup DB VM '$INSTANCE' created"
