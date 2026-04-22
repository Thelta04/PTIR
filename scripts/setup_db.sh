#!/bin/bash
# scripts/setup_db.sh
# Usage: ./setup_db.sh [DB_NAME] [DB_USER] [DB_PASSWORD]

DB_NAME=${1:-"tuxy_db"}
DB_USER=${2:-"tuxy_user"}
DB_PASSWORD=${3:-"tuxy_password"}

export DEBIAN_FRONTEND=noninteractive

# Wait for any existing apt/dpkg locks (unattended-upgrades on fresh VMs)
echo "Waiting for dpkg lock to be released..."
while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
    sleep 2
done

# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Configure PostgreSQL to allow remote connections
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf
echo "host all all 10.10.10.0/24 md5" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf

# Setup Database and User
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Initialize schema
if [ -f "/tmp/schema.sql" ]; then
    sudo -u postgres psql -d $DB_NAME -f /tmp/schema.sql
fi

# Load initial data
if [ -f "/tmp/inserts.sql" ]; then
    sudo -u postgres psql -d $DB_NAME -f /tmp/inserts.sql
fi

# Grant table-level permissions to the app user
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
sudo -u postgres psql -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"
sudo -u postgres psql -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;"

# Restart PostgreSQL
sudo systemctl restart postgresql
echo "Database setup complete!"
