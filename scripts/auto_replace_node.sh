#!/bin/bash
# scripts/auto_replace_node.sh
# Usage: ./auto_replace_node.sh <VM_TYPE: lb|db|web> <FAILED_INSTANCE_NAME>

VM_TYPE=$1
FAILED_INSTANCE=$2

PROJECT_ID="project-dc8596f3-77e8-4941-a9a"
ZONE="europe-southwest1-c"

# Extract the index from the failed instance name (e.g., lb-01 -> 01)
INDEX=$(echo $FAILED_INSTANCE | grep -oE '[0-9]+$')
NEW_INDEX=$(printf "%02d" $((10#$INDEX + 2))) # Skip current backup to create a new one

NEW_INSTANCE="${VM_TYPE}-${NEW_INDEX}"

echo "Detected failure of $FAILED_INSTANCE. Provisioning replacement $NEW_INSTANCE..."

# 1. Determine IP and Tags
case $VM_TYPE in
    lb)
        # Assuming we use 10.10.10.10, 11, 12, ...
        IP_SUFFIX=$((10 + 10#$NEW_INDEX - 1))
        IP_ADDRESS="10.10.10.$IP_SUFFIX"
        TAGS="http-server,lb-server"
        MACHINE_TYPE="e2-micro"
        ;;
    db)
        IP_SUFFIX=$((30 + 10#$NEW_INDEX - 1))
        IP_ADDRESS="10.10.10.$IP_SUFFIX"
        TAGS="db-server"
        MACHINE_TYPE="e2-micro"
        ;;
    web)
        IP_SUFFIX=$((20 + 10#$NEW_INDEX - 1))
        IP_ADDRESS="10.10.10.$IP_SUFFIX"
        TAGS="webapp-server"
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
    --network=lan \
    --subnet=lan \
    --tags="$TAGS"

# 3. Trigger deployment for the new VM
# In a real scenario, we'd run a subset of deploy.sh here.
# For this prototype, we'll just note it.
echo "New instance $NEW_INSTANCE created at $IP_ADDRESS. Please run scripts/deploy.sh to configure it."
