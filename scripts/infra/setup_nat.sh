#!/bin/bash
# scripts/infra/setup_nat.sh
# Sets up Cloud NAT for the 'lan' network to allow outbound internet access for private VMs.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/config.sh"

echo "Setting up Cloud NAT for network: $NETWORK in region: $REGION..."

# Create Cloud Router
gcloud compute routers create "${NETWORK}-router" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --network="$NETWORK" \
    --quiet 2>/dev/null || echo "Router ${NETWORK}-router already exists."

#Create Cloud NAT
gcloud compute routers nats create "${NETWORK}-nat" \
    --project="$PROJECT_ID" \
    --router="${NETWORK}-router" \
    --region="$REGION" \
    --auto-allocate-nat-external-ips \
    --nat-all-subnet-ip-ranges \
    --quiet 2>/dev/null || echo "NAT ${NETWORK}-nat already exists."

echo "Cloud NAT setup complete"
