#!/bin/bash
# scripts/images/create_web_vm.sh
# Creates a webapp VM using the pre-baked tuxy-web image

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/config.sh"
source "$SCRIPT_DIR/../common/utils.sh"

echo "Discovering existing webapp instances..."
WEBAPP_INSTANCES=$(get_instances_by_tag "$TAG_WEB")

if [ -z "$WEBAPP_INSTANCES" ]; then
    NEW_NUM=1
    NEW_IP="10.10.10.20"
else
    # Find the highest webapp IP and instance number
    MAX_SUFFIX=0
    MAX_NUM=0
    for INST in $WEBAPP_INSTANCES; do
        IP=$(gcloud compute instances describe "$INST" \
            --project="$PROJECT_ID" --zone="$ZONE" \
            --format='get(networkInterfaces[0].networkIP)')
        SUFFIX=${IP##*.}
        NUM=$(echo "$INST" | grep -oP '\d+$')

        if [ "$SUFFIX" -gt "$MAX_SUFFIX" ]; then MAX_SUFFIX=$SUFFIX; fi
        if [ "$NUM" -gt "$MAX_NUM" ]; then MAX_NUM=$NUM; fi
    done
    NEW_SUFFIX=$((MAX_SUFFIX + 1))
    NEW_NUM=$((MAX_NUM + 1))
    NEW_IP="10.10.10.$NEW_SUFFIX"
fi

NEW_NAME="web-$NEW_NUM"
echo "Creating WebApp VM '$NEW_NAME' ($NEW_IP)"
gcloud compute instances create "$NEW_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-small \
    --image-family=tuxy-web \
    --private-network-ip="$NEW_IP" \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="$TAG_WEB" \
    --no-address

echo "WebApp VM '$NEW_NAME' created"
