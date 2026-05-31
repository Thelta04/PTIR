#!/bin/bash
# scripts/promote_lb_backup.sh
# Promotes the backup load balancer (lb-02) to active by reassigning the
# static public IP from lb-01 to lb-02.
# Usage: ./promote_lb_backup.sh

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/config.sh"
source "$SCRIPT_DIR/common/utils.sh"

PRIMARY="lb-01"
BACKUP="lb-02"

echo "Promoting $BACKUP to active load balancer..."

# Remove external IP from lb-01
echo "Removing external IP from $PRIMARY..."
gcloud compute instances delete-access-config "$PRIMARY" \
    --access-config-name="$ACCESS_CONFIG_NAME" \
    --zone="$ZONE" --project="$PROJECT_ID" --quiet 2>/dev/null || true

# Assign external IP to lb-02
echo "Assigning external IP ($EXTERNAL_IP) to $BACKUP..."
gcloud compute instances add-access-config "$BACKUP" \
    --access-config-name="$ACCESS_CONFIG_NAME" \
    --address="$EXTERNAL_IP" \
    --zone="$ZONE" --project="$PROJECT_ID" --quiet || {
    echo "ERROR: Failed to assign external IP to $BACKUP."
    exit 1
}

echo ""
echo "Promotion complete! '$BACKUP' ($LB_BACKUP_IP) is now the active load balancer."
echo "External IP $EXTERNAL_IP is now pointing to $BACKUP."
