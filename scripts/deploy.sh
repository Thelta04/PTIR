#!/bin/bash
# scripts/deploy.sh
# Full deployment: DB → WebApp (rolling) → Load Balancers
# This is the ONLY script needed to go from clean VMs to a working app.

set -e
set -o pipefail

PROJECT_ID="project-dc8596f3-77e8-4941-a9a"
ZONE="europe-southwest1-c"
REMOTE_USER="athen"
WEBAPP_INSTANCES="web-1 web-2"
DB_INSTANCES="db db-backup"
LB_INSTANCES="lb lb-backup"
TARGET_DIR="/home/$REMOTE_USER/app"
DB_HOST="10.10.10.30"
DB_PORT="5432"

# Read DB credentials from .env
DB_NAME=$(grep '^DB_NAME=' .env | cut -d'=' -f2)
DB_USER=$(grep '^DB_USER=' .env | cut -d'=' -f2)
DB_PASSWORD=$(grep '^DB_PASSWORD=' .env | cut -d'=' -f2)

# Helper: run a command on a remote VM via gcloud SSH
remote_exec() {
    local instance="$1"
    shift
    gcloud compute ssh "$instance" \
        --project="$PROJECT_ID" \
        --zone="$ZONE" \
        --tunnel-through-iap \
        --command="$*"
}

# Helper: upload files to a remote VM via gcloud SCP
remote_scp() {
    local instance="$1"
    shift
    gcloud compute scp "$@" "$instance:/tmp/" \
        --project="$PROJECT_ID" \
        --zone="$ZONE" \
        --tunnel-through-iap
}

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

    # Upload setup script and SQL files
    remote_scp "$DB_INSTANCE" scripts/setup_db.sh database/schema.sql database/inserts.sql

    # Run setup on the remote VM
    remote_exec "$DB_INSTANCE" "
        set -e
        export DEBIAN_FRONTEND=noninteractive

        # Wait for any existing apt/dpkg locks (unattended-upgrades on fresh VMs)
        echo 'Waiting for dpkg lock to be released...'
        while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
            sleep 2
        done

        # Check if PostgreSQL is already installed and running
        if systemctl is-active --quiet postgresql 2>/dev/null; then
            echo 'PostgreSQL is already running on $DB_INSTANCE. Skipping install.'
            # Still ensure config is correct
            sudo sed -i \"s/#listen_addresses = 'localhost'/listen_addresses = '*'/\" /etc/postgresql/*/main/postgresql.conf
            if ! sudo grep -q '10.10.10.0/24' /etc/postgresql/*/main/pg_hba.conf; then
                echo 'host all all 10.10.10.0/24 md5' | sudo tee -a /etc/postgresql/*/main/pg_hba.conf
                sudo systemctl restart postgresql
            fi
            # Re-apply schema and data to keep DB in sync
            echo 'Re-applying schema.sql and inserts.sql...'
            sudo -u postgres psql -d $DB_NAME -f /tmp/schema.sql
            sudo -u postgres psql -d $DB_NAME -f /tmp/inserts.sql
            # Re-grant permissions after schema recreation
            sudo -u postgres psql -d $DB_NAME -c \"GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;\"
            sudo -u postgres psql -d $DB_NAME -c \"GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;\"
        else
            echo 'Installing and configuring PostgreSQL...'
            chmod +x /tmp/setup_db.sh
            /tmp/setup_db.sh '$DB_NAME' '$DB_USER' '$DB_PASSWORD'
        fi

        echo 'Database setup complete on $DB_INSTANCE.'
    " || { echo "ERROR: Failed to setup $DB_INSTANCE"; exit 1; }
done

# Verify primary DB is reachable from the first webapp VM (local machine can't reach private IPs)
FIRST_WEBAPP=$(echo $WEBAPP_INSTANCES | awk '{print $1}')
echo ""
echo "Verifying DB reachability from $FIRST_WEBAPP..."
remote_exec "$FIRST_WEBAPP" "
    for attempt in \$(seq 1 20); do
        if timeout 2 bash -c 'echo > /dev/tcp/$DB_HOST/$DB_PORT' 2>/dev/null; then
            echo 'Database at $DB_HOST:$DB_PORT is reachable!'
            exit 0
        fi
        echo \"  DB not ready yet... (\$attempt/20)\"
        sleep 2
    done
    echo 'ERROR: Database at $DB_HOST:$DB_PORT not reachable after 40s.'
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

    # Get Internal IP for LB configuration later
    IP=$(gcloud compute instances describe "$INSTANCE" \
        --project="$PROJECT_ID" --zone="$ZONE" \
        --format='get(networkInterfaces[0].networkIP)')
    WEBAPP_IPS+="$IP,"

    # Upload artifacts
    remote_scp "$INSTANCE" /tmp/webapp_artifacts.tar.gz

    # Upload the remote setup script
    remote_scp "$INSTANCE" scripts/setup_webapp_remote.sh

    # Execute the setup script on the remote VM
    remote_exec "$INSTANCE" "
        set -e
        chmod +x /tmp/setup_webapp_remote.sh
        /tmp/setup_webapp_remote.sh '$TARGET_DIR' '$REMOTE_USER' '$FIRST_VM' '$INSTANCE'
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

    remote_scp "$LB_INSTANCE" scripts/setup_lb.sh scripts/lb_healthcheck.sh

    remote_exec "$LB_INSTANCE" "
        set -e
        sudo mkdir -p $TARGET_DIR/scripts
        sudo mv /tmp/setup_lb.sh /tmp/lb_healthcheck.sh $TARGET_DIR/scripts/
        sudo chmod +x $TARGET_DIR/scripts/setup_lb.sh $TARGET_DIR/scripts/lb_healthcheck.sh
        sudo $TARGET_DIR/scripts/setup_lb.sh '$WEBAPP_IPS'
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
