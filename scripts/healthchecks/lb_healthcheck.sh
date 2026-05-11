#!/bin/bash
# scripts/lb_healthcheck.sh
# Runs on Load Balancer VM (via cron, every minute).
# Healthchecks WebApp VMs and updates ONLY the Nginx upstream block,
# preserving the rest of the config (HTTPS, headers, etc.).

IPS_FILE="/etc/nginx/webapp_ips.txt"
CONFIG_FILE="/etc/nginx/sites-available/tuxy.pt"

if [ ! -f "$IPS_FILE" ] || [ ! -f "$CONFIG_FILE" ]; then
    exit 0
fi

IPS=$(cat "$IPS_FILE" | tr ',' ' ')
HEALTHY_SERVERS=""

for IP in $IPS; do
    if curl -s --max-time 2 "http://$IP:8000/api/check/" > /dev/null; then
        HEALTHY_SERVERS+="    server $IP:8000;\n"
    fi
done

# If no healthy IPs, keep old config to avoid 502.
if [ -z "$HEALTHY_SERVERS" ]; then
    exit 0
fi

# Build the new upstream block
NEW_UPSTREAM=$(printf "upstream webapp_servers {\n%b}" "$HEALTHY_SERVERS")

# Extract the current upstream block for comparison
OLD_UPSTREAM=$(awk '/^upstream webapp_servers \{/{found=1} found{print} found && /^\}/{exit}' "$CONFIG_FILE")

if [ "$OLD_UPSTREAM" = "$NEW_UPSTREAM" ]; then
    exit 0
fi

# Replace only the upstream block, preserving all server blocks (HTTP, HTTPS, etc.)
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

# Validate config before applying
cp "$CONFIG_FILE" /tmp/lb_config_backup
mv /tmp/lb_config_new "$CONFIG_FILE"

if nginx -t 2>/dev/null; then
    systemctl reload nginx
else
    # Restore original if validation fails
    mv /tmp/lb_config_backup "$CONFIG_FILE"
    echo "$(date): nginx config validation failed after upstream update" >> /var/log/lb_healthcheck.log
fi
