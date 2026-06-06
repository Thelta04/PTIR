#!/bin/bash
# scripts/create_db_primary.sh
# Creates and starts the primary database instance (db-01).
# Usage: ./create_db_primary.sh

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/common/config.sh"
source "$SCRIPT_DIR/common/utils.sh"

INSTANCE="db-01"

# Read DB credentials from .env
if [ ! -f "$ROOT_DIR/.env" ]; then
    echo "ERROR: .env file not found in $ROOT_DIR."
    exit 1
fi
DB_NAME=$(grep '^DB_NAME=' "$ROOT_DIR/.env" | cut -d'=' -f2)
DB_USER=$(grep '^DB_USER=' "$ROOT_DIR/.env" | cut -d'=' -f2)
DB_PASSWORD=$(grep '^DB_PASSWORD=' "$ROOT_DIR/.env" | cut -d'=' -f2)

# Create VM if it doesn't exist
echo "Creating Primary Database VM ($DB_PRIMARY_IP)..."
gcloud compute instances create "$INSTANCE" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-small \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip="$DB_PRIMARY_IP" \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="$TAG_DB" \
    --no-address \
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

# Upload and run setup
echo "Deploying primary database on $INSTANCE..."
remote_scp "$INSTANCE" \
    "$SCRIPT_DIR/setup/setup_db.sh" \
    "$SCRIPT_DIR/common/config.sh" \
    "$SCRIPT_DIR/common/utils.sh" \
    "$ROOT_DIR/database/schema.sql" \
    "$ROOT_DIR/database/inserts.sql" \
    "$SCRIPT_DIR/healthchecks/db_healthcheck.sh" \
    "$SCRIPT_DIR/firewall/db-01-firewall-rules.sh"

remote_exec "$INSTANCE" "
    set -e
    source /tmp/config.sh
    source /tmp/utils.sh
    wait_for_dpkg_lock
    chmod +x /tmp/setup_db.sh /tmp/db-01-firewall-rules.sh
    /tmp/setup_db.sh '$DB_NAME' '$DB_USER' '$DB_PASSWORD' 'primary' '$DB_PRIMARY_IP'
    sudo /tmp/db-01-firewall-rules.sh
" || { echo "ERROR: Failed to setup $INSTANCE"; exit 1; }

echo ""
echo "Primary database '$INSTANCE' ($DB_PRIMARY_IP) is running."
