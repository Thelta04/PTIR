#!/bin/bash
# scripts/deploy/deploy_all.sh
# Orchestrates a full deployment: DB → WebApp → Load Balancer

set -e
set -o pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================="
echo "Starting FULL deployment"
echo "=================================================="

# Deploy Database
"$DEPLOY_DIR/deploy_db.sh"

# Deploy WebApp
"$DEPLOY_DIR/deploy_webapp.sh"

# Deploy Load Balancer
"$DEPLOY_DIR/deploy_lb.sh"

echo ""
echo "=================================================="
echo "FULL deployment SUCCESSFUL"
echo "=================================================="
