#!/bin/bash
# scripts/lb_healthcheck.sh
# Runs on Load Balancer VM.
# Healthchecks WebApp VMs and updates Nginx upstream.

IPS_FILE="/etc/nginx/webapp_ips.txt"
CONFIG_FILE="/etc/nginx/sites-available/loadbalancer"

if [ ! -f "$IPS_FILE" ]; then
    exit 0
fi

IPS=$(cat "$IPS_FILE" | tr ',' ' ')
HEALTHY_IPS=""

for IP in $IPS; do
    # Check if the server is up on port 8000 /api/check/
    if curl -s --max-time 2 "http://$IP:8000/api/check/" > /dev/null; then
        HEALTHY_IPS+="    server $IP:8000;\n"
    fi
done

# If no healthy IPs, maybe leave one or keep old config? 
# For now, let's keep old config if no one is healthy to avoid 502 completely.
if [ -z "$HEALTHY_IPS" ]; then
    exit 0
fi

# Generate new config
NEW_CONFIG=$(cat <<EOF
upstream webapp_servers {
$(echo -e "$HEALTHY_IPS")
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://webapp_servers;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_pass_header X-Served-By;
    }
}
EOF
)

# Compare and reload
OLD_MD5=$(md5sum "$CONFIG_FILE" | awk '{print $1}')
echo "$NEW_CONFIG" > /tmp/lb_config_new
NEW_MD5=$(md5sum /tmp/lb_config_new | awk '{print $1}')

if [ "$OLD_MD5" != "$NEW_MD5" ]; then
    mv /tmp/lb_config_new "$CONFIG_FILE"
    systemctl reload nginx
fi
