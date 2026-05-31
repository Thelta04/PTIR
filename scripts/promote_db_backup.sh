#!/bin/bash
# scripts/promote_db_backup.sh
# Promotes the backup database (db-02) to primary after the primary (db-01) fails.
# DB failover on the webapp side is handled automatically.
# Usage: ./promote_db_backup.sh

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/config.sh"
source "$SCRIPT_DIR/common/utils.sh"

INSTANCE="db-02"

echo "Checking current state of $INSTANCE..."

IS_REPLICA=$(remote_exec "$INSTANCE" "sudo -u postgres psql -c 'select pg_is_in_recovery();' -t" | xargs)

if [ "$IS_REPLICA" = "t" ]; then
    echo "$INSTANCE is currently a REPLICA. Promoting to PRIMARY..."
    remote_exec "$INSTANCE" "sudo -u postgres psql -c 'SELECT pg_promote();'"

    # Wait for promotion to complete
    echo "Waiting for promotion to take effect..."
    for i in $(seq 1 12); do
        IS_RECOVERY=$(remote_exec "$INSTANCE" "sudo -u postgres psql -c 'select pg_is_in_recovery();' -t" | xargs)
        if [ "$IS_RECOVERY" = "f" ]; then
            echo ""
            echo "Promotion successful! '$INSTANCE' ($DB_BACKUP_IP) is now the PRIMARY database."
            exit 0
        fi
        echo "  Still in recovery mode... ($((i*5))s)"
        sleep 5
    done
    echo "ERROR: Promotion did not complete within 60s."
    exit 1
else
    echo "$INSTANCE is already the PRIMARY database. No action needed."
fi
