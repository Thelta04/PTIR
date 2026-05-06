#!/bin/bash
# scripts/deploy/deploy_all.sh
# Orchestrates a full deployment: DB → WebApp → Load Balancer

set -e
set -o pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================="
echo "Starting FULL deployment"
echo "=================================================="

# 1. Deploy Database
"$DEPLOY_DIR/deploy_db.sh"

# 2. Deploy WebApp
"$DEPLOY_DIR/deploy_webapp.sh"

# 3. Deploy Load Balancer
"$DEPLOY_DIR/deploy_lb.sh"

echo ""
echo "=================================================="
echo "FULL deployment SUCCESSFUL!"
echo "=================================================="
