#!/bin/bash
# scripts/create_vms.sh
# Usage: ./create_vms.sh [NUM_WEBAPP_VMS]

PROJECT_ID=project-dc8596f3-77e8-4941-a9a
REGION=europe-southwest1
ZONE=europe-southwest1-c
NUM_WEBAPP_VMS=${NUM_WEBAPP_VMS:-2}

echo "Using project: $PROJECT_ID in region: $REGION and zone: $ZONE"

echo "Creating Primary Database VM (10.10.10.30)..."
gcloud compute instances create db \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip=10.10.10.30 \
    --network=lan \
    --subnet=lan \
    --tags=db-server

echo "Creating Database Backup VM (10.10.10.31)..."
gcloud compute instances create db-backup \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip=10.10.10.31 \
    --network=lan \
    --subnet=lan \
    --tags=db-server

echo "Creating Primary Load Balancer VM (10.10.10.10)..."
gcloud compute instances create lb \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip=10.10.10.10 \
    --network=lan \
    --subnet=lan \
    --tags=http-server,lb-server \
    --address=tuxy-lb-ip

echo "Creating Load Balancer Backup VM (10.10.10.11)..."
gcloud compute instances create lb-backup \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --private-network-ip=10.10.10.11 \
    --network=lan \
    --subnet=lan \
    --tags=http-server,lb-server

# 5. Create WebApp VMs (Backend + Frontend)
# Assigned from 10.10.10.20 to 10.10.10.29
for i in $(seq 1 $NUM_WEBAPP_VMS); do
    IP_SUFFIX=$((19 + i))
    IP_ADDRESS="10.10.10.$IP_SUFFIX"
    echo "Creating WebApp VM $i ($IP_ADDRESS)..."
    gcloud compute instances create web-$i \
        --project=$PROJECT_ID \
        --zone=$ZONE \
        --machine-type=e2-small \
        --image-family=ubuntu-2204-lts \
        --image-project=ubuntu-os-cloud \
        --private-network-ip=$IP_ADDRESS \
        --network=lan \
    --subnet=lan \
        --tags=webapp-server
done

echo "VM creation complete!"
