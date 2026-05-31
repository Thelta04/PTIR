#!/bin/bash
# scripts/kill_app_server.sh
# Terminates a specific app server instance by stopping its services.
# The LB healthcheck will automatically detect the failure and stop routing traffic.
# Usage: ./kill_app_server.sh <instance-name>
#   e.g. ./kill_app_server.sh web-2

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common/config.sh"
source "$SCRIPT_DIR/common/utils.sh"

INSTANCE="${1:?Usage: $0 <instance-name> (e.g. web-2)}"

echo "Stopping services on $INSTANCE..."

remote_exec "$INSTANCE" "
    sudo systemctl stop nginx || true
    sudo systemctl stop gunicorn || true
    echo 'Services stopped.'
"

echo ""
echo "App server '$INSTANCE' has been terminated."
echo "The LB healthcheck will automatically remove it from the upstream pool within 60s."
