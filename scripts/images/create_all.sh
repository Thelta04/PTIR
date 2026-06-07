#!/bin/bash
# scripts/images/create_all.sh
# Runs all image creation scripts in sequence, creating two app servers.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting deployment of all VMs from images..."

echo "1. Creating Bastion Host..."
bash "$SCRIPT_DIR/create_bastion.sh"

echo "2. Creating Primary Database (db-01)..."
bash "$SCRIPT_DIR/create_db_primary.sh"

echo "3. Creating Backup Database (db-02)..."
bash "$SCRIPT_DIR/create_db_backup.sh"

echo "4. Creating Primary Load Balancer (lb-01)..."
bash "$SCRIPT_DIR/create_lb.sh"

echo "5. Creating Backup Load Balancer (lb-02)..."
bash "$SCRIPT_DIR/create_lb_backup.sh"

echo "6. Creating First App Server (web-1)..."
bash "$SCRIPT_DIR/create_app_server.sh"

echo "7. Creating Second App Server (web-2)..."
bash "$SCRIPT_DIR/create_app_server.sh"

echo "All VMs successfully created from their respective images!"
