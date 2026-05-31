#!/bin/bash
# scripts/healthchecks/notify_master.sh
# Called by keepalived when transitioning to MASTER state.
# Floats the external IP to the new MASTER instance.

exec > /var/log/keepalived_notify.log 2>&1
set -x

# Source centralized config if available
SCRIPT_DIR="/home/athen/app/scripts"
[ -f "$SCRIPT_DIR/config.sh" ] && source "$SCRIPT_DIR/config.sh"

MY_NAME=$(hostname)

# Fallback values if config.sh is not available
ZONE="${ZONE:-europe-southwest1-c}"
PROJECT_ID="${PROJECT_ID:-project-dc8596f3-77e8-4941-a9a}"
EXTERNAL_IP="${EXTERNAL_IP:-34.175.164.1}"
CONFIG_NAME="${ACCESS_CONFIG_NAME:-external-nat}"

echo "$(date) - Transitioned to MASTER state on $MY_NAME"

if [[ "$MY_NAME" == *"-01"* ]]; then
    PEER_NAME=$(echo $MY_NAME | sed 's/-01/-02/')
else
    PEER_NAME=$(echo $MY_NAME | sed 's/-02/-01/')
fi

echo "Removing access config from peer $PEER_NAME..."
gcloud compute instances delete-access-config "$PEER_NAME" \
    --access-config-name="$CONFIG_NAME" \
    --zone="$ZONE" --project="$PROJECT_ID" --quiet || true

echo "Adding access config to $MY_NAME..."
gcloud compute instances add-access-config "$MY_NAME" \
    --access-config-name="$CONFIG_NAME" \
    --address="$EXTERNAL_IP" \
    --zone="$ZONE" --project="$PROJECT_ID" --quiet || true

echo "$(date) - External IP failover complete"
