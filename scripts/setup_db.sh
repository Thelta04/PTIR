#!/bin/bash
# scripts/setup_db.sh
# Usage: ./setup_db.sh [DB_NAME] [DB_USER] [DB_PASSWORD] [MODE] [PRIMARY_IP]

# Load utilities if they were uploaded to /tmp
[ -f /tmp/utils.sh ] && source /tmp/utils.sh
[ -f /tmp/config.sh ] && source /tmp/config.sh

DB_NAME=${1:-$DB_NAME_DEFAULT}
DB_USER=${2:-$DB_USER_DEFAULT}
DB_PASSWORD=$3
MODE=${4:-"primary"}
PRIMARY_IP=${5:-$DB_PRIMARY_IP}

export DEBIAN_FRONTEND=noninteractive

# Wait for any existing apt/dpkg locks
wait_for_dpkg_lock

# Install PostgreSQL
sudo apt-get update -qq
sudo apt-get install -y postgresql postgresql-contrib -qq

# Configure PostgreSQL
PG_VERSION=$(psql -V | awk '{print $3}' | cut -d. -f1)
CONF_DIR="/etc/postgresql/$PG_VERSION/main"

# Function to update or add config (Idempotent)
set_pg_config() {
    local key=$1
    local value=$2
    if sudo grep -q "^$key" "$CONF_DIR/postgresql.conf"; then
        sudo sed -i "s|^$key.*|$key = $value|" "$CONF_DIR/postgresql.conf"
    else
        echo "$key = $value" | sudo tee -a "$CONF_DIR/postgresql.conf"
    fi
}

set_pg_config "listen_addresses" "'*'"
set_pg_config "wal_level" "replica"
set_pg_config "max_wal_senders" "10"
set_pg_config "wal_keep_size" "64MB"

# Access control (pg_hba.conf) - Idempotent
add_hba_rule() {
    local rule=$1
    if ! sudo grep -q "$rule" "$CONF_DIR/pg_hba.conf"; then
        echo "$rule" | sudo tee -a "$CONF_DIR/pg_hba.conf"
    fi
}

add_hba_rule "host all all $INTERNAL_CIDR md5"
add_hba_rule "host replication replication $INTERNAL_CIDR md5"

if [ "$MODE" = "primary" ]; then
    echo "Configuring as PRIMARY..."
    sudo systemctl restart postgresql
    
    # Setup Database and User (Idempotent)
    sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
    sudo -u postgres psql -c "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    
    # Create replication user (Idempotent)
    sudo -u postgres psql -c "SELECT 1 FROM pg_roles WHERE rolname = 'replication'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER replication WITH REPLICATION PASSWORD '$DB_PASSWORD';"

    # Initialize schema and data
    if [ -f "/tmp/schema.sql" ]; then
        sudo -u postgres psql -d $DB_NAME -f /tmp/schema.sql
    fi
    if [ -f "/tmp/inserts.sql" ]; then
        sudo -u postgres psql -d $DB_NAME -f /tmp/inserts.sql
    fi

    # Grant permissions
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
    
    sudo systemctl restart postgresql
else
    echo "Configuring as REPLICA of $PRIMARY_IP..."
    
    # Check if already a replica and running
    if sudo [ -f "/var/lib/postgresql/$PG_VERSION/main/standby.signal" ] && sudo systemctl is-active --quiet postgresql; then
        echo "PostgreSQL is already configured as a replica and running."
    else
        sudo systemctl stop postgresql
        
        # Retry pg_basebackup
        SUCCESS=false
        for i in {1..10}; do
            echo "Attempting pg_basebackup (Attempt $i/10)..."
            
            sudo rm -rf "/var/lib/postgresql/$PG_VERSION/main"
            sudo mkdir -p "/var/lib/postgresql/$PG_VERSION/main"
            sudo chown postgres:postgres "/var/lib/postgresql/$PG_VERSION/main"
            sudo chmod 700 "/var/lib/postgresql/$PG_VERSION/main"

            if (cd /tmp && sudo -u postgres PGPASSWORD="$DB_PASSWORD" pg_basebackup -h "$PRIMARY_IP" -D "/var/lib/postgresql/$PG_VERSION/main" -U replication -P -v -R); then
                SUCCESS=true
                break
            fi
            echo "  Attempt failed. Retrying in 5s..."
            sleep 5
        done

        if [ "$SUCCESS" = "false" ]; then
            echo "ERROR: Failed to clone database from primary!"
            exit 1
        fi
        
        sudo systemctl start postgresql
    fi
fi

echo "Database setup complete ($MODE)!"
