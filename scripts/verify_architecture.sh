#!/bin/bash
# scripts/verify_architecture.sh
# Automates the verification of the multi-tier architecture.

PROJECT_ID="project-dc8596f3-77e8-4941-a9a"
ZONE="europe-southwest1-c"
LB_IP=34.175.164.1

# Helper function to run remote commands
remote_exec() {
    gcloud compute ssh "$1" --project="$PROJECT_ID" --zone="$ZONE" --tunnel-through-iap --command="$2" 2>/dev/null
}

echo "=================================================="
echo " Starting Architecture Verification Suite"
echo "=================================================="

# ---------------------------------------------------------
# 1. Prove Load Balancing
# ---------------------------------------------------------
echo ""
echo "▶ TEST 1: Load Balancing (X-Served-By Header)"
echo "  Sending 10 requests to LB ($LB_IP)..."

SERVED_BY_WEB1=0
SERVED_BY_WEB2=0

for i in {1..10}; do
    # Using curl -I to get headers. tr -d '\r' to clean up potential line endings.
    SERVER=$(curl -s -I "http://$LB_IP/" | grep -i "X-Served-By" | awk '{print $2}' | tr -d '\r' | xargs)
    if [ "$SERVER" = "web-1" ]; then
        ((SERVED_BY_WEB1++))
    elif [ "$SERVER" = "web-2" ]; then
        ((SERVED_BY_WEB2++))
    fi
done

echo "  Results: web-1 served $SERVED_BY_WEB1, web-2 served $SERVED_BY_WEB2"
if [ "$SERVED_BY_WEB1" -gt 0 ] && [ "$SERVED_BY_WEB2" -gt 0 ]; then
    echo "  ✅ PASS: Traffic is being distributed across both VMs."
else
    echo "  ❌ FAIL: Traffic is not being distributed correctly. Found: web-1=$SERVED_BY_WEB1, web-2=$SERVED_BY_WEB2"
fi

# ---------------------------------------------------------
# 2. Prove Tier Dependency
# ---------------------------------------------------------
echo ""
echo "▶ TEST 2: Tier Dependency (Database Kill-Switch)"
echo "  Stopping PostgreSQL on 'db' VM..."
remote_exec "db" "sudo systemctl stop postgresql"

echo "  Checking API Health (Expecting Failure)..."
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://$LB_IP/api/check/")

if [ "$HTTP_CODE" = "500" ] || [ "$HTTP_CODE" = "502" ] || [ "$HTTP_CODE" = "000" ]; then
    echo "  ✅ PASS: API failed as expected when DB is down (HTTP $HTTP_CODE)."
else
    echo "  ❌ FAIL: API returned HTTP $HTTP_CODE instead of an error. Is it truly dependent?"
fi

echo "  Starting PostgreSQL on 'db' VM..."
remote_exec "db" "sudo systemctl start postgresql"
sleep 5 # give it a moment to recover

# ---------------------------------------------------------
# 3. Prove High Availability (Failover)
# ---------------------------------------------------------
echo ""
echo "▶ TEST 3: High Availability (Web-1 Failover)"
echo "  Stopping Nginx on 'web-1'..."
remote_exec "web-1" "sudo systemctl stop nginx"
sleep 5 # let LB health check detect failure (cron runs every minute, so we wait or just rely on the script being used after detection)

echo "  Sending 5 requests to LB..."
SERVED_BY_WEB1=0
SERVED_BY_WEB2=0

for i in {1..5}; do
    SERVER=$(curl -s -I "http://$LB_IP/" | grep -i "X-Served-By" | awk '{print $2}' | tr -d '\r' | xargs)
    if [ "$SERVER" = "web-1" ]; then ((SERVED_BY_WEB1++)); fi
    if [ "$SERVER" = "web-2" ]; then ((SERVED_BY_WEB2++)); fi
done

echo "  Results: web-1 served $SERVED_BY_WEB1, web-2 served $SERVED_BY_WEB2"
if [ "$SERVED_BY_WEB1" -eq 0 ] && [ "$SERVED_BY_WEB2" -eq 5 ]; then
    echo "  ✅ PASS: LB successfully routed all traffic to web-2 when web-1 failed."
else
    echo "  ❌ FAIL: LB did not failover correctly or healthcheck didn't trigger yet. Found: web-1=$SERVED_BY_WEB1, web-2=$SERVED_BY_WEB2"
fi

echo "  Starting Nginx on 'web-1'..."
remote_exec "web-1" "sudo systemctl start nginx"

# ---------------------------------------------------------
# 4. Prove Tier Isolation
# ---------------------------------------------------------
echo ""
echo "▶ TEST 4: Tier Isolation (Port Audits)"

check_port() {
    local vm=$1
    local port=$2
    local should_be_open=$3
    
    IS_OPEN=$(remote_exec "$vm" "sudo ss -tulpn | grep -q ':$port ' && echo 'yes' || echo 'no'")
    
    if [ "$IS_OPEN" = "$should_be_open" ]; then
        echo "  ✅ PASS: $vm port $port is $IS_OPEN (expected: $should_be_open)"
    else
        echo "  ❌ FAIL: $vm port $port is $IS_OPEN (expected: $should_be_open)"
    fi
}

echo "  Auditing 'lb' VM:"
check_port "lb" "80" "yes"
check_port "lb" "8000" "no"
check_port "lb" "5432" "no"

echo "  Auditing 'web-1' VM:"
check_port "web-1" "8000" "yes"
check_port "web-1" "5432" "no"

echo "  Auditing 'db' VM:"
check_port "db" "5432" "yes"
check_port "db" "8000" "no"

echo ""
echo "=================================================="
echo " Verification Complete!"
echo "=================================================="
