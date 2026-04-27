#!/bin/bash
# scripts/deploy.sh
# Full deployment: DB → WebApp (rolling) → Load Balancers

set -e
set -o pipefail

# Load configuration and utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"
source "$SCRIPT_DIR/utils.sh"

# Dynamic Instance Discovery
echo "Discovering instances..."
WEBAPP_INSTANCES=$(get_instances_by_tag "$TAG_WEB")
DB_INSTANCES=$(get_instances_by_tag "$TAG_DB")
LB_INSTANCES=$(get_instances_by_tag "$TAG_LB")

echo "Targets: DB ($DB_INSTANCES), Web ($WEBAPP_INSTANCES), LB ($LB_INSTANCES)"

# Read DB credentials from .env
if [ ! -f .env ]; then
    echo "ERROR: .env file not found locally. Required for DB credentials."
    exit 1
fi
DB_NAME=$(grep '^DB_NAME=' .env | cut -d'=' -f2)
DB_USER=$(grep '^DB_USER=' .env | cut -d'=' -f2)
DB_PASSWORD=$(grep '^DB_PASSWORD=' .env | cut -d'=' -f2)

echo "=================================================="
echo "Starting FULL deployment for $PROJECT_ID"
echo "=================================================="

# ============================================================
# PHASE 0: Build Frontend Locally & Package Artifacts
# ============================================================
echo ""
echo "--- Phase 0: Build & Package ---"

echo "Building frontend..."
(cd frontend && npm install && npm run build)

echo "Packaging artifacts..."
cp .env backend/.env
tar -czf /tmp/webapp_artifacts.tar.gz --exclude='backend/venv' --exclude='__pycache__' backend/ frontend/dist/ scripts/ database/
rm backend/.env

# ============================================================
# PHASE 1: Setup Database VMs
# ============================================================
echo ""
echo "--- Phase 1: Database Setup ---"

for DB_INSTANCE in $DB_INSTANCES; do
    echo ""
    echo "=================================================="
    echo "Setting up database: $DB_INSTANCE"
    echo "=================================================="

    # Upload setup script, config, utils and SQL files
    remote_scp "$DB_INSTANCE" scripts/setup_db.sh scripts/config.sh scripts/utils.sh database/schema.sql database/inserts.sql

    # Run setup on the remote VM
    remote_exec "$DB_INSTANCE" "
        set -e
        source /tmp/config.sh
        source /tmp/utils.sh
        
        wait_for_dpkg_lock

        # Determine mode
        if [[ \"$DB_INSTANCE\" == *\"-01\"* ]]; then
            MODE=\"primary\"
        else
            MODE=\"replica\"
        fi

        echo \"Installing and configuring PostgreSQL as \$MODE...\"
        chmod +x /tmp/setup_db.sh
        /tmp/setup_db.sh '$DB_NAME' '$DB_USER' '$DB_PASSWORD' \"\$MODE\" \"$DB_PRIMARY_IP\"
    " || { echo "ERROR: Failed to setup $DB_INSTANCE"; exit 1; }
done

# Verify primary DB reachability from the first webapp VM
FIRST_WEBAPP=$(echo $WEBAPP_INSTANCES | awk '{print $1}')
echo ""
echo "Verifying DB reachability from $FIRST_WEBAPP..."
remote_exec "$FIRST_WEBAPP" "
    for attempt in \$(seq 1 20); do
        if timeout 2 bash -c 'echo > /dev/tcp/$DB_PRIMARY_IP/$DB_PORT' 2>/dev/null; then
            echo 'Database at $DB_PRIMARY_IP:$DB_PORT is reachable!'
            exit 0
        fi
        echo \"  DB not ready yet... (\$attempt/20)\"
        sleep 2
    done
    echo 'ERROR: Database at $DB_PRIMARY_IP:$DB_PORT not reachable after 40s.'
    exit 1
" || { echo "ERROR: DB not reachable from webapp VMs. Aborting."; exit 1; }

# ============================================================
# PHASE 2: Rolling Update for WebApp VMs
# ============================================================
echo ""
echo "--- Phase 2: WebApp Deployment (Rolling) ---"

FIRST_VM=true
WEBAPP_IPS=""

for INSTANCE in $WEBAPP_INSTANCES; do
    echo ""
    echo "=================================================="
    echo "Deploying to $INSTANCE..."
    echo "=================================================="

    IP=$(gcloud compute instances describe "$INSTANCE" \
        --project="$PROJECT_ID" --zone="$ZONE" \
        --format='get(networkInterfaces[0].networkIP)')
    WEBAPP_IPS+="$IP,"

    remote_scp "$INSTANCE" /tmp/webapp_artifacts.tar.gz scripts/config.sh scripts/utils.sh scripts/setup_webapp.sh

    remote_exec "$INSTANCE" "
        set -e
        chmod +x /tmp/setup_webapp.sh
        /tmp/setup_webapp.sh '$TARGET_DIR' '$REMOTE_USER' '$FIRST_VM' '$INSTANCE'
    " || { echo "ERROR: Deployment FAILED on $INSTANCE. Aborting rolling update!"; exit 1; }

    FIRST_VM=false
done

# ============================================================
# PHASE 3: Update Load Balancers
# ============================================================
echo ""
echo "--- Phase 3: Load Balancer Setup ---"

WEBAPP_IPS=${WEBAPP_IPS%,} # Remove trailing comma

for LB_INSTANCE in $LB_INSTANCES; do
    echo ""
    echo "=================================================="
    echo "Updating Load Balancer: $LB_INSTANCE"
    echo "=================================================="

    remote_scp "$LB_INSTANCE" scripts/setup_lb.sh scripts/lb_healthcheck.sh scripts/config.sh scripts/utils.sh

    remote_exec "$LB_INSTANCE" "
        set -e
        source /tmp/config.sh
        sudo mkdir -p \$TARGET_DIR/scripts
        sudo mv /tmp/setup_lb.sh /tmp/lb_healthcheck.sh /tmp/config.sh /tmp/utils.sh \$TARGET_DIR/scripts/
        sudo chmod +x \$TARGET_DIR/scripts/setup_lb.sh \$TARGET_DIR/scripts/lb_healthcheck.sh
        sudo \$TARGET_DIR/scripts/setup_lb.sh '$WEBAPP_IPS'
    " || echo "WARNING: Failed to update LB $LB_INSTANCE"
done

# ============================================================
# PHASE 4: Cleanup
# ============================================================
echo ""
echo "--- Phase 4: Cleanup ---"
rm -f /tmp/webapp_artifacts.tar.gz

echo ""
echo "=================================================="
echo "Deployment SUCCESSFUL across all instances!"
echo "=================================================="
