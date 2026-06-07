#!/bin/bash
# scripts/create_db_backup.sh
# Creates and starts the backup database instance (db-02) as a replica.
# Usage: ./create_db_backup.sh

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/common/config.sh"
source "$SCRIPT_DIR/common/utils.sh"

INSTANCE="db-02"

# Read DB credentials from .env
if [ ! -f "$ROOT_DIR/.env" ]; then
    echo "ERROR: .env file not found in $ROOT_DIR."
    exit 1
fi
DB_NAME=$(grep '^POSTGRES_DB=' "$ROOT_DIR/.env" | cut -d'=' -f2)
DB_USER=$(grep '^POSTGRES_USER=' "$ROOT_DIR/.env" | cut -d'=' -f2)
DB_PASSWORD=$(grep '^POSTGRES_PASSWORD=' "$ROOT_DIR/.env" | cut -d'=' -f2)

# Create VM if it doesn't exist
echo "Creating Database Backup VM ($DB_BACKUP_IP)..."
gcloud compute instances create "$INSTANCE" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-small \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip="$DB_BACKUP_IP" \
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
echo "Deploying replica database on $INSTANCE..."
remote_scp "$INSTANCE" \
    "$SCRIPT_DIR/setup/setup_db.sh" \
    "$SCRIPT_DIR/common/config.sh" \
    "$SCRIPT_DIR/common/utils.sh" \
    "$ROOT_DIR/database/schema.sql" \
    "$ROOT_DIR/database/inserts.sql" \
    "$SCRIPT_DIR/healthchecks/db_healthcheck.sh" \
    "$SCRIPT_DIR/firewall/db-02-firewall-rules.sh"

remote_exec "$INSTANCE" "
    set -e
    source /tmp/config.sh
    source /tmp/utils.sh
    wait_for_dpkg_lock
    chmod +x /tmp/setup_db.sh /tmp/db-02-firewall-rules.sh
    /tmp/setup_db.sh '$DB_NAME' '$DB_USER' '$DB_PASSWORD' 'replica' '$DB_PRIMARY_IP'
    sudo /tmp/db-02-firewall-rules.sh
" || { echo "ERROR: Failed to setup $INSTANCE"; exit 1; }

echo ""
echo "Backup database '$INSTANCE' ($DB_BACKUP_IP) is running as replica of $DB_PRIMARY_IP."
