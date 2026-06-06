#!/bin/bash
# scripts/verify_architecture.sh
# Automates the verification of the multi-tier architecture.

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common/config.sh"

# Load DB credentials from .env
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
if [ -f "$ROOT_DIR/.env" ]; then
    DB_NAME=$(grep '^DB_NAME=' "$ROOT_DIR/.env" | cut -d'=' -f2)
    DB_USER=$(grep '^DB_USER=' "$ROOT_DIR/.env" | cut -d'=' -f2)
    DB_PASSWORD=$(grep '^DB_PASSWORD=' "$ROOT_DIR/.env" | cut -d'=' -f2)
fi

# Use provided IP or fallback to the one used before
LB_IP="${1:-34.175.164.1}"

# Helper function to run remote commands
remote_exec() {
    gcloud compute ssh "${REMOTE_USER}@$1" --project="$PROJECT_ID" --zone="$ZONE" --tunnel-through-iap --command="$2" 2>/dev/null
}

# Cleanup function to restore system to default state
cleanup() {
    echo ""
    echo "=================================================="
    echo " Restoring System to Default State..."
    echo "=================================================="
    
    # Restore Database Tier
    echo "  Ensuring PostgreSQL is running on db-01..."
    remote_exec "db-01" "sudo systemctl start postgresql"
    
    # Wait for db-01 to be ready
    sleep 5

    # Check if db-02 was promoted to primary
    IS_DB2_PRIMARY=$(remote_exec "db-02" "sudo -u postgres psql -c 'select pg_is_in_recovery();' -t" | xargs)
    if [ "$IS_DB2_PRIMARY" = "f" ]; then
        echo "  Detected: db-02 was promoted to PRIMARY. Reverting to REPLICA..."
        # Re-run setup_db.sh on db-02 to restore replication
        # Upload setup_db.sh if it might be missing or to ensure latest
        gcloud compute scp "$SCRIPT_DIR/../setup/setup_db.sh" "$SCRIPT_DIR/../common/utils.sh" "$SCRIPT_DIR/../config.sh" "${REMOTE_USER}@db-02:/tmp/" --project="$PROJECT_ID" --zone="$ZONE" --tunnel-through-iap 2>/dev/null
        remote_exec "db-02" "chmod +x /tmp/setup_db.sh && sudo /tmp/setup_db.sh '$DB_NAME' '$DB_USER' '$DB_PASSWORD' 'replica' '$DB_PRIMARY_IP'"
    else
        echo "  db-02 is already in replica mode."
    fi

    # Restore Other Tiers
    echo "  Ensuring Nginx is running on web-1..."
    remote_exec "web-1" "sudo systemctl start nginx"
    echo "  Ensuring Nginx is running on lb-01..."
    remote_exec "lb-01" "sudo systemctl start nginx"
    
    echo "  Forcing LB healthcheck update to restore web-1 upstream..."
    remote_exec "lb-01" "sudo /usr/local/bin/lb_healthcheck.sh"
    remote_exec "lb-02" "sudo /usr/local/bin/lb_healthcheck.sh"

    echo " Restoration complete."
}

# Register the cleanup function to run on exit (success or failure)
trap cleanup EXIT

echo "=================================================="
echo " Starting Architecture Verification Suite"
echo "=================================================="

# ---------------------------------------------------------
# 0. Check: API Operational
# ---------------------------------------------------------
echo ""
echo "▶ TEST 0: API Operational Check"
echo "  Checking if API is reachable through LB ($LB_IP)..."
HTTP_CODE=$(curl -k -L -s -o /dev/null -w '%{http_code}' "http://$LB_IP/api/check/")

if [ "$HTTP_CODE" = "200" ]; then
    echo "   PASS: API is reachable (HTTP 200)."
else
    echo "  ❌ FAIL: API is not reachable (HTTP $HTTP_CODE)."
fi

# ---------------------------------------------------------
# Prove Load Balancing
# ---------------------------------------------------------
echo ""
echo "▶ TEST 1: Load Balancing (X-Served-By Header)"
echo "  Sending 10 requests to LB ($LB_IP)..."

SERVED_BY_WEB1=0
SERVED_BY_WEB2=0

for i in {1..10}; do
    # Get all headers and grep for X-Served-By
    HEADERS=$(curl -k -L -s -I "http://$LB_IP/")
    SERVER=$(echo "$HEADERS" | grep -i "X-Served-By" | awk '{print $2}' | tr -d '\r' | xargs)
    
    if [ "$SERVER" = "web-1" ]; then
        ((SERVED_BY_WEB1++))
    elif [ "$SERVER" = "web-2" ]; then
        ((SERVED_BY_WEB2++))
    else
        # If it fails, let's see why
        if [ $i -eq 1 ]; then
           echo "    DEBUG: Headers for first request:"
           echo "$HEADERS" | sed 's/^/      /'
        fi
    fi
done

echo "  Results: web-1 served $SERVED_BY_WEB1, web-2 served $SERVED_BY_WEB2"
if [ "$SERVED_BY_WEB1" -gt 0 ] && [ "$SERVED_BY_WEB2" -gt 0 ]; then
    echo "   PASS: Traffic is being distributed across both VMs."
else
    echo "  ❌ FAIL: Traffic is not being distributed correctly. Found: web-1=$SERVED_BY_WEB1, web-2=$SERVED_BY_WEB2"
    echo "     (Make sure you redeployed with the latest scripts!)"
fi

# ---------------------------------------------------------
# Prove Tier Dependency
# ---------------------------------------------------------
echo ""
echo "▶ TEST 2: Tier Dependency (Database Kill-Switch)"
echo "  Stopping PostgreSQL on 'db-01' VM..."
remote_exec "db-01" "sudo systemctl stop postgresql"

echo "  Checking API Health (Expecting Failure)..."
# Wait a few seconds for connections to actually fail
sleep 2
HTTP_CODE=$(curl -k -L -s -o /dev/null -w '%{http_code}' "http://$LB_IP/api/check/")

if [ "$HTTP_CODE" = "500" ] || [ "$HTTP_CODE" = "503" ] || [ "$HTTP_CODE" = "502" ] || [ "$HTTP_CODE" = "000" ]; then
    echo "   PASS: API failed as expected when DB is down (HTTP $HTTP_CODE)."
else
    echo "  ❌ FAIL: API returned HTTP $HTTP_CODE instead of an error. Is it truly dependent?"
fi

echo "  Starting PostgreSQL on 'db-01' VM..."
remote_exec "db-01" "sudo systemctl start postgresql"
sleep 5 # give it a moment to recover

# ---------------------------------------------------------
# Prove High Availability (Failover)
# ---------------------------------------------------------
echo ""
echo "▶ TEST 3: High Availability (Web-1 Failover)"
echo "  Stopping Nginx on 'web-1'..."
remote_exec "web-1" "sudo systemctl stop nginx"
echo "  Waiting for LB healthcheck to detect failure..."
sleep 10

echo "  Sending 5 requests to LB..."
SERVED_BY_WEB1=0
SERVED_BY_WEB2=0

for i in {1..5}; do
    SERVER=$(curl -k -L -s -I "http://$LB_IP/" | grep -i "X-Served-By" | awk '{print $2}' | tr -d '\r' | xargs)
    if [ "$SERVER" = "web-1" ]; then ((SERVED_BY_WEB1++)); fi
    if [ "$SERVER" = "web-2" ]; then ((SERVED_BY_WEB2++)); fi
done

echo "  Results: web-1 served $SERVED_BY_WEB1, web-2 served $SERVED_BY_WEB2"
if [ "$SERVED_BY_WEB1" -eq 0 ] && [ "$SERVED_BY_WEB2" -eq 5 ]; then
    echo "   PASS: LB successfully routed all traffic to web-2 when web-1 failed."
else
    echo "  ❌ FAIL: LB did not failover correctly. Found: web-1=$SERVED_BY_WEB1, web-2=$SERVED_BY_WEB2"
fi

echo "  Starting Nginx on 'web-1'..."
remote_exec "web-1" "sudo systemctl start nginx"

# ---------------------------------------------------------
# Prove LB Failover & Auto-Replacement
# ---------------------------------------------------------
echo ""
echo "▶ TEST 4: LB Failover (Keepalived VIP)"
echo "  Stopping Nginx on 'lb-01' (Primary)..."
remote_exec "lb-01" "sudo systemctl stop nginx"

echo "  Waiting for VIP to migrate to 'lb-02' (up to 20s)..."
VIP_DETECTED=false
for i in {1..4}; do
    echo "    Attempt $i: Checking if 'lb-02' has the VIP ($LB_VIP)..."
    HAS_VIP=$(remote_exec "lb-02" "ip addr show | grep -q '$LB_VIP' && echo 'yes' || echo 'no'" | xargs)
    if [ "$HAS_VIP" = "yes" ]; then
        echo "   PASS: 'lb-02' has successfully assumed the Virtual IP ($LB_VIP)"
        VIP_DETECTED=true
        break
    fi
    sleep 5
done

if [ "$VIP_DETECTED" = "false" ]; then
    echo "  ❌ FAIL: 'lb-02' did NOT assume the Virtual IP within 20s."
    exit 1
fi

echo "  Verifying if API is reachable through 'lb-02' internal IP..."
HTTP_CODE=$(remote_exec "bastion" "curl -k -s -o /dev/null -w '%{http_code}' -H 'Host: tuxy.pt' --max-time 2 'https://10.10.10.11/api/check/'" | xargs)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   PASS: API is reachable through 'lb-02' internal IP"
else
    echo "  ❌ FAIL: API is unreachable through 'lb-02' (HTTP $HTTP_CODE)."
    exit 1
fi

echo "  Starting Nginx on 'lb-01'..."
remote_exec "lb-01" "sudo systemctl start nginx"

# ---------------------------------------------------------
# Prove DB Replication, Failover & Auto-Replacement
# ---------------------------------------------------------
echo ""
echo "▶ TEST 5: Database Replication, Failover & Auto-Replacement"
echo "  Verifying Replication Status on 'db-02'..."
REPLICA_STATUS=$(remote_exec "db-02" "sudo -u postgres psql -c 'select count(*) from pg_stat_wal_receiver;' -t" | xargs)

if [ "${REPLICA_STATUS:-0}" -gt 0 ]; then
    echo "   PASS: Database replication is active on db-02."
else
    echo "  ❌ FAIL: Database replication is NOT active."
fi

echo "  Stopping PostgreSQL on 'db-01'..."
remote_exec "db-01" "sudo systemctl stop postgresql"

# Wait for automatic promotion by cron job
echo "  Waiting for automatic promotion of 'db-02' (this may take up to 90s)..."
PROMOTED=false
for i in {1..18}; do
    IS_RECOVERY=$(remote_exec "db-02" "sudo -u postgres psql -c 'select pg_is_in_recovery();' -t" | xargs)
    if [ "$IS_RECOVERY" = "f" ]; then
        echo "   PASS: 'db-02' was automatically promoted to Primary"
        PROMOTED=true
        break
    fi
    echo "  ... still in recovery mode ($((i*5))s)"
    sleep 5
done

if [ "$PROMOTED" = "false" ]; then
    echo "  ❌ FAIL: 'db-02' was NOT automatically promoted within 90s."
    exit 1
fi

echo "  Verifying API Health (should point to promoted DB)..."
HTTP_CODE=$(curl -k -L -s -o /dev/null -w '%{http_code}' "http://$LB_IP/api/check/")
if [ "$HTTP_CODE" = "200" ]; then
    echo "   PASS: API is still healthy after automatic failover"
else
    echo "  ❌ FAIL: API is NOT healthy after failover (HTTP $HTTP_CODE)."
    exit 1
fi


echo "  Starting PostgreSQL on 'db-01'..."
remote_exec "db-01" "sudo systemctl start postgresql"

# ---------------------------------------------------------
# Prove Tier Isolation
# ---------------------------------------------------------
echo ""
echo "▶ TEST 6: Tier Isolation (Port Audits)"

check_port() {
    local vm=$1
    local port=$2
    local should_be_open=$3
    
    # Use -E for regex and match port bound to any address or specific IP
    # Matches :80 (space), :80 (tab), or :80 (end of line)
    IS_OPEN=$(remote_exec "$vm" "sudo ss -tulpn | grep -qE \"[:\*]$port(\$|[[:space:]])\" && echo 'yes' || echo 'no'")
    
    if [ "$IS_OPEN" = "$should_be_open" ]; then
        echo "   PASS: $vm port $port is $IS_OPEN (expected: $should_be_open)"
    else
        echo "  ❌ FAIL: $vm port $port is $IS_OPEN (expected: $should_be_open)"
    fi
}

echo "  Auditing 'lb-01' VM:"
check_port "lb-01" "80" "yes"
check_port "lb-01" "8000" "no"
check_port "lb-01" "5432" "no"

echo "  Auditing 'lb-02' VM:"
check_port "lb-02" "80" "yes"
check_port "lb-02" "8000" "no"
check_port "lb-02" "5432" "no"

echo "  Auditing 'web-1' VM:"
check_port "web-1" "8000" "yes"
check_port "web-1" "5432" "no"

echo "  Auditing 'web-2' VM:"
check_port "web-2" "8000" "yes"
check_port "web-2" "5432" "no"

echo "  Auditing 'db-01' VM:"
check_port "db-01" "5432" "yes"
check_port "db-01" "8000" "no"

echo "  Auditing 'db-02' VM:"
check_port "db-02" "5432" "yes"
check_port "db-02" "8000" "no"

echo ""
echo "=================================================="
echo " Verification Complete"
echo "=================================================="