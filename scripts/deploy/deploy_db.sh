#!/bin/bash
# scripts/deploy/deploy_db.sh
# Phase 1: Database Setup

set -e
set -o pipefail

# Load configuration and utilities
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/../.." && pwd)"
source "$DEPLOY_DIR/../common/config.sh"
source "$DEPLOY_DIR/../common/utils.sh"

# Dynamic Instance Discovery
echo "Discovering database instances..."
DB_INSTANCES=$(get_instances_by_tag "$TAG_DB")
WEBAPP_INSTANCES=$(get_instances_by_tag "$TAG_WEB")

echo "Targets: DB ($DB_INSTANCES)"

# Read DB credentials from .env
if [ ! -f "$ROOT_DIR/.env" ]; then
    echo "ERROR: .env file not found in $ROOT_DIR. Required for DB credentials."
    exit 1
fi
DB_NAME=$(grep '^DB_NAME=' "$ROOT_DIR/.env" | cut -d'=' -f2)
DB_USER=$(grep '^DB_USER=' "$ROOT_DIR/.env" | cut -d'=' -f2)
DB_PASSWORD=$(grep '^DB_PASSWORD=' "$ROOT_DIR/.env" | cut -d'=' -f2)

echo "--- Database Setup ---"

for DB_INSTANCE in $DB_INSTANCES; do
    echo ""
    echo "=================================================="
    echo "Setting up database: $DB_INSTANCE"
    echo "=================================================="

    # Upload setup script, config, utils, SQL files and healthcheck script
    remote_scp "$DB_INSTANCE" \
        "$DEPLOY_DIR/../setup/setup_db.sh" \
        "$DEPLOY_DIR/../common/config.sh" \
        "$DEPLOY_DIR/../common/utils.sh" \
        "$ROOT_DIR/database/schema.sql" \
        "$ROOT_DIR/database/inserts.sql" \
        "$DEPLOY_DIR/../healthchecks/db_healthcheck.sh"

    # Run setup on the remote VM
    remote_exec "$DB_INSTANCE" "
        set -e
        source /tmp/config.sh
        source /tmp/utils.sh
        
        wait_for_dpkg_lock

        # Determine mode
        if [[ \"$DB_INSTANCE\" == *\"-01\"* ]]; then
            MODE=\"primary\"
        else
            MODE=\"replica\"
        fi

        echo \"Installing and configuring PostgreSQL as \$MODE...\"
        chmod +x /tmp/setup_db.sh
        /tmp/setup_db.sh '$DB_NAME' '$DB_USER' '$DB_PASSWORD' \"\$MODE\" \"$DB_PRIMARY_IP\"
    " || { echo "ERROR: Failed to setup $DB_INSTANCE"; exit 1; }
done

# Verify primary DB reachability from the first webapp VM
FIRST_WEBAPP=$(echo $WEBAPP_INSTANCES | awk '{print $1}')
if [ -n "$FIRST_WEBAPP" ]; then
    echo ""
    echo "Verifying DB reachability from $FIRST_WEBAPP..."
    remote_exec "$FIRST_WEBAPP" "
        for attempt in \$(seq 1 20); do
            if timeout 2 bash -c 'echo > /dev/tcp/$DB_PRIMARY_IP/$DB_PORT' 2>/dev/null; then
                echo 'Database at $DB_PRIMARY_IP:$DB_PORT is reachable!'
                exit 0
            fi
            echo \"  DB not ready yet... (\$attempt/20)\"
            sleep 2
        done
        echo 'ERROR: Database at $DB_PRIMARY_IP:$DB_PORT not reachable after 40s.'
        exit 1
    " || { echo "ERROR: DB not reachable from webapp VMs. Aborting."; exit 1; }
else
    echo "WARNING: No WebApp instances found to verify DB reachability."
fi

echo "Database deployment successful!"
