#!/bin/bash
# scripts/infra/create_vms.sh
# Usage: ./create_vms.sh [NUM_WEBAPP_VMS]

set -e
set -o pipefail

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/config.sh"

NUM_WEBAPP_VMS=${1:-2}

echo "Using project: $PROJECT_ID in region: $REGION and zone: $ZONE"

# Database VMs
echo "--- Creating Database VMs ---"
"$SCRIPT_DIR/../create_db_primary.sh"
"$SCRIPT_DIR/../create_db_backup.sh"

# Load Balancer VMs
echo "--- Creating Load Balancer VMs ---"
"$SCRIPT_DIR/../create_lb.sh"
"$SCRIPT_DIR/../create_lb_backup.sh"

# WebApp VMs
echo "--- Creating WebApp VMs ($NUM_WEBAPP_VMS instances) ---"
for i in $(seq 1 "$NUM_WEBAPP_VMS"); do
    "$SCRIPT_DIR/../create_app_server.sh"
done

echo "VM creation and initial deployment complete!"
