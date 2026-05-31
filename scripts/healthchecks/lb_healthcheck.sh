#!/bin/bash
# scripts/healthchecks/lb_healthcheck.sh
# Runs on Load Balancer VM (via cron, every minute).
# Dynamically discovers WebApp VMs and updates the Nginx upstream block.

# Try to source config for dynamic discovery
SCRIPT_DIR="/home/athen/app/scripts"
[ -f "$SCRIPT_DIR/config.sh" ] && source "$SCRIPT_DIR/config.sh"

IPS_FILE="/etc/nginx/webapp_ips.txt"
CONFIG_FILE="/etc/nginx/sites-available/tuxy.pt"

if [ ! -f "$CONFIG_FILE" ]; then
    exit 0
fi

# Discover IPs (Dynamic fallback to Static)
if command -v gcloud >/dev/null 2>&1 && [ -n "$TAG_WEB" ]; then
    # Try to get IPs from GCP dynamically
    CURRENT_IPS=$(gcloud compute instances list \
        --filter="tags.items=$TAG_WEB" \
        --project="$PROJECT_ID" \
        --format="value(networkInterfaces[0].networkIP)" 2>/dev/null | xargs | tr ' ' ',')
    
    if [ -n "$CURRENT_IPS" ]; then
        # Update the static file for persistence/fallback
        echo "$CURRENT_IPS" | sudo tee "$IPS_FILE" > /dev/null
    fi
fi

# Load IPs from file (either updated above or original)
if [ -f "$IPS_FILE" ]; then
    IPS=$(cat "$IPS_FILE" | tr ',' ' ')
else
    exit 0
fi

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
