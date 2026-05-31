#!/bin/bash
# scripts/kill_db_primary.sh
# Stops the primary database (db-01), allowing observation of system behavior
# when the DB becomes unavailable. The replica healthcheck will auto-promote db-02.
# Usage: ./kill_db_primary.sh

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/config.sh"
source "$SCRIPT_DIR/common/utils.sh"

INSTANCE="db-01"

echo "Stopping PostgreSQL on $INSTANCE ($DB_PRIMARY_IP)..."

remote_exec "$INSTANCE" "sudo systemctl stop postgresql"

echo ""
echo "Primary database '$INSTANCE' has been stopped."
echo "The replica healthcheck on db-02 will detect this failure and auto-promote within ~60s."
