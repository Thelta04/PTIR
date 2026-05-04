#!/bin/bash
# scripts/db_healthcheck.sh
# Runs on DB VMs. Promotes itself to primary if it's a replica and primary is down.

PRIMARY_IP=$1

# Check if PostgreSQL is currently in recovery mode (meaning it is a replica)
IS_REPLICA=$(sudo -u postgres psql -c 'select pg_is_in_recovery();' -t | xargs)

if [ "$IS_REPLICA" = "t" ]; then
    echo "Node is currently a REPLICA. Checking primary at $PRIMARY_IP..."
    
    # Test primary connection (3 attempts with 2s timeout)
    SUCCESS=false
    for i in {1..3}; do
        if pg_isready -h "$PRIMARY_IP" -p 5432 -t 2 > /dev/null; then
            SUCCESS=true
            break
        fi
        echo "  Attempt $i: Primary $PRIMARY_IP is unreachable."
        sleep 2
    done
    
    if [ "$SUCCESS" = "false" ]; then
        echo "Primary $PRIMARY_IP is confirmed DOWN! Promoting this replica to PRIMARY..."
        sudo -u postgres psql -c 'SELECT pg_promote();'
        echo "Promotion command issued."
    else
        echo "Primary $PRIMARY_IP is healthy."
    fi
else
    echo "Node is already PRIMARY. No action needed."
fi
