#!/bin/bash
# scripts/create_vms.sh
# Usage: ./create_vms.sh [NUM_WEBAPP_VMS]

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/config.sh"

NUM_WEBAPP_VMS=${1:-2}

echo "Using project: $PROJECT_ID in region: $REGION and zone: $ZONE"

# Database VMs
echo "Creating Primary Database VM ($DB_PRIMARY_IP)..."
gcloud compute instances create db-01 \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip="$DB_PRIMARY_IP" \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="$TAG_DB" \
    --no-address

echo "Creating Database Backup VM (10.10.10.31)..."
gcloud compute instances create db-02 \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip=10.10.10.31 \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="$TAG_DB" \
    --no-address

# Load Balancer VMs
echo "Creating Primary Load Balancer VM (10.10.10.10)..."
gcloud compute instances create lb-01 \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip=10.10.10.10 \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="http-server,$TAG_LB" \
    --address=tuxy-lb-ip

echo "Creating Load Balancer Backup VM (10.10.10.11)..."
gcloud compute instances create lb-02 \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip=10.10.10.11 \
    --network="$NETWORK" \
    --subnet="$SUBNET" \
    --tags="http-server,$TAG_LB" \
    --no-address

# WebApp VMs
for i in $(seq 1 $NUM_WEBAPP_VMS); do
    IP_SUFFIX=$((19 + i))
    IP_ADDRESS="10.10.10.$IP_SUFFIX"
    echo "Creating WebApp VM web-$i ($IP_ADDRESS)..."
    gcloud compute instances create "web-$i" \
        --project="$PROJECT_ID" \
        --zone="$ZONE" \
        --machine-type=e2-small \
        --image-family=ubuntu-2204-lts \
        --image-project=ubuntu-os-cloud \
        --private-network-ip="$IP_ADDRESS" \
        --network="$NETWORK" \
        --subnet="$SUBNET" \
        --tags="$TAG_WEB" \
        --no-address
done

echo "VM creation complete!"
