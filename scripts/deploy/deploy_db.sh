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

echo "--- Database Setup ---"

echo "Deploying primary database..."
"$DEPLOY_DIR/../create_db_primary.sh"

echo "Deploying backup database..."
"$DEPLOY_DIR/../create_db_backup.sh"

# Dynamic Instance Discovery for reachability check
echo "Discovering webapp instances..."
WEBAPP_INSTANCES=$(get_instances_by_tag "$TAG_WEB")

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
