#!/bin/bash
# scripts/infra/setup_firewall.sh
# Reimplements and secures GCP firewall rules for the project.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/config.sh"

# Ensure Internal App & DB communication is allowed
echo "Ensuring internal network rules..."
# Including vrrp (protocol 112) for Keepalived unicast communication
gcloud compute firewall-rules create allow-internal-app \
    --project="$PROJECT_ID" --network="$NETWORK" \
    --allow=tcp:8000,tcp:80,tcp:5173,icmp,vrrp \
    --source-ranges="$INTERNAL_CIDR" \
    --quiet 2>/dev/null || echo "Rule allow-internal-app updated/exists."

gcloud compute firewall-rules create allow-internal-db \
    --project="$PROJECT_ID" --network="$NETWORK" \
    --allow=tcp:5432 \
    --source-ranges="$INTERNAL_CIDR" \
    --quiet 2>/dev/null || echo "Rule allow-internal-db exists."

# Ensure IAP SSH access
echo "Ensuring IAP SSH access..."
gcloud compute firewall-rules create allow-ssh-iap \
    --project="$PROJECT_ID" --network="$NETWORK" \
    --allow=tcp:22 \
    --source-ranges="35.235.240.0/20" \
    --quiet 2>/dev/null || echo "Rule allow-ssh-iap exists."

# Ensure public HTTP/HTTPS access explicitly for Load Balancers (tagged http-server/https-server)
echo "Ensuring public HTTP/HTTPS for tagged servers..."
gcloud compute firewall-rules create lan-allow-http \
    --project="$PROJECT_ID" --network="$NETWORK" \
    --allow=tcp:80 \
    --source-ranges="0.0.0.0/0" \
    --target-tags="http-server" \
    --quiet 2>/dev/null || echo "Rule lan-allow-http exists."

gcloud compute firewall-rules create lan-allow-https \
    --project="$PROJECT_ID" --network="$NETWORK" \
    --allow=tcp:443 \
    --source-ranges="0.0.0.0/0" \
    --target-tags="https-server" \
    --quiet 2>/dev/null || echo "Rule lan-allow-https exists."

# Ensure Health Check rules for Load Balancers
echo "Ensuring Load Balancer health check rules..."
gcloud compute firewall-rules create lan-allow-health-check \
    --project="$PROJECT_ID" --network="$NETWORK" \
    --allow=tcp \
    --source-ranges="35.191.0.0/16,130.211.0.0/22,209.85.152.0/22,209.85.204.0/22" \
    --target-tags="lb-health-check" \
    --quiet 2>/dev/null || echo "Rule lan-allow-health-check exists."

echo "Firewall reimplementation complete!"
