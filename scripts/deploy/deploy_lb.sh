#!/bin/bash
# scripts/deploy/deploy_lb.sh
# Phase 3: Load Balancer Setup

set -e
set -o pipefail

# Load configuration and utilities
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "--- Load Balancer Setup ---"

echo "Deploying primary load balancer..."
"$DEPLOY_DIR/../create_lb.sh"

echo "Deploying backup load balancer..."
"$DEPLOY_DIR/../create_lb_backup.sh"

echo "Load Balancer deployment successful"
