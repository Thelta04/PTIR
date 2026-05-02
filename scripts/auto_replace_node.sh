#!/bin/bash
# scripts/auto_replace_node.sh
# Usage: ./auto_replace_node.sh <VM_TYPE: lb|db|web> <FAILED_INSTANCE_NAME>

VM_TYPE=$1
FAILED_INSTANCE=$2

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Extract the index from the failed instance name (e.g., lb-01 -> 01)
INDEX=$(echo $FAILED_INSTANCE | grep -oE '[0-9]+$')
NEW_INDEX=$(printf "%02d" $((10#$INDEX + 2))) # Skip current backup to create a new one

NEW_INSTANCE="${VM_TYPE}-${NEW_INDEX}"

echo "Detected failure of $FAILED_INSTANCE. Provisioning replacement $NEW_INSTANCE..."

# 1. Determine IP and Tags
case $VM_TYPE in
    lb)
        IP_SUFFIX=$((10 + 10#$NEW_INDEX - 1))
        IP_ADDRESS="10.10.10.$IP_SUFFIX"
        TAGS="http-server,$TAG_LB"
        MACHINE_TYPE="e2-micro"
        ;;
    db)
        IP_SUFFIX=$((30 + 10#$NEW_INDEX - 1))
        IP_ADDRESS="10.10.10.$IP_SUFFIX"
        TAGS="$TAG_DB"
        MACHINE_TYPE="e2-micro"
        ;;
    web)
        IP_SUFFIX=$((20 + 10#$NEW_INDEX - 1))
        IP_ADDRESS="10.10.10.$IP_SUFFIX"
        TAGS="$TAG_WEB"
        MACHINE_TYPE="e2-small"
        ;;
    *)
        echo "Unknown VM type: $VM_TYPE"
        exit 1
        ;;
esac

# 2. Create the VM
gcloud compute instances create "$NEW_INSTANCE" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip="$IP_ADDRESS" \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="$TAGS"

# 3. Trigger deployment for the new VM
echo "--------------------------------------------------"
echo "New instance $NEW_INSTANCE created at $IP_ADDRESS."
echo "CRITICAL: Run scripts/deploy.sh now to configure the new node."
echo "The new node will be automatically discovered via its tags."
echo "--------------------------------------------------"
