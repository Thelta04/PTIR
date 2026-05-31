#!/bin/bash
# scripts/infra/create_vms.sh
# Usage: ./create_vms.sh [NUM_WEBAPP_VMS]

set -e
set -o pipefail  

# 1. Deploy Bastion and DBs
./create_bastion.sh &
./create_db_primary.sh &
wait

# 2. Deploy DB Backup (depends on Primary)
./create_db_backup.sh &
wait

# 3. Deploy App Servers (depends on DBs existing)
./create_app_server.sh &
wait

# 4. Deploy Load Balancers
./create_lb.sh &
./create_lb_backup.sh &
wait
