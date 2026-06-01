#!/bin/bash
# scripts/healthchecks/lb_healthcheck.sh
# Runs on Load Balancer VM (via cron, every minute).
# Discovers WebApp VMs by scanning the webapp IP range on port 8000.
# No gcloud or external dependencies required.

CONFIG_FILE="/etc/nginx/sites-available/tuxy.pt"
IPS_FILE="/etc/nginx/webapp_ips.txt"

# Webapp IP range (10.10.10.20 - 10.10.10.29)
WEBAPP_IP_PREFIX="10.10.10"
WEBAPP_IP_START=20
WEBAPP_IP_END=29

if [ ! -f "$CONFIG_FILE" ]; then
    exit 0
fi

# Discover healthy webapps by scanning the IP range
HEALTHY_SERVERS=""
DISCOVERED_IPS=""
for i in $(seq $WEBAPP_IP_START $WEBAPP_IP_END); do
    IP="${WEBAPP_IP_PREFIX}.${i}"
    if curl -s --max-time 2 "http://$IP:8000/api/check/" > /dev/null; then
        HEALTHY_SERVERS+="    server $IP:8000;\n"
        DISCOVERED_IPS+="$IP,"
    fi
done

# If no healthy IPs, keep old config to avoid 502.
if [ -z "$HEALTHY_SERVERS" ]; then
    exit 0
fi

# Persist discovered IPs for reference
echo "${DISCOVERED_IPS%,}" | sudo tee "$IPS_FILE" > /dev/null

# Build the new upstream block
NEW_UPSTREAM=$(printf "upstream webapp_servers {\n%b}" "$HEALTHY_SERVERS")

# Extract the current upstream block for comparison
OLD_UPSTREAM=$(awk '/^upstream webapp_servers \{/{found=1} found{print} found && /^\}/{exit}' "$CONFIG_FILE")

if [ "$OLD_UPSTREAM" = "$NEW_UPSTREAM" ]; then
    exit 0
fi

# Replace only the upstream block
awk -v new_upstream="$NEW_UPSTREAM" '
/^upstream webapp_servers \{/ {
    print new_upstream
    skip = 1
    next
}
skip && /^\}/ {
    skip = 0
    next
}
!skip { print }
' "$CONFIG_FILE" > /tmp/lb_config_new

# Validate and apply
cp "$CONFIG_FILE" /tmp/lb_config_backup
mv /tmp/lb_config_new "$CONFIG_FILE"

if nginx -t 2>/dev/null; then
    systemctl reload nginx
else
    mv /tmp/lb_config_backup "$CONFIG_FILE"
    echo "$(date): nginx config validation failed after upstream update" >> /var/log/lb_healthcheck.log
fi
