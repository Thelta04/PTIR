#!/bin/bash
# scripts/kill_lb_primary.sh
# Stops the Nginx process on the primary load balancer (lb-01) without shutting
# down the VM. Keepalived will detect the failure and promote lb-02 automatically.
# Usage: ./kill_lb_primary.sh

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/config.sh"
source "$SCRIPT_DIR/common/utils.sh"

INSTANCE="lb-01"

echo "Stopping Nginx on $INSTANCE ($LB_PRIMARY_IP)..."

remote_exec "$INSTANCE" "sudo systemctl stop nginx"

echo ""
echo "Nginx on '$INSTANCE' has been stopped."
echo "Keepalived will detect the failure and promote lb-02 to MASTER automatically."
echo "The VIP ($LB_VIP) and external IP ($EXTERNAL_IP) will migrate to lb-02."
