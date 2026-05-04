#!/bin/bash
# scripts/setup_lb.sh
# Usage: ./setup_lb.sh [INITIAL_WEBAPP_IPS_COMMA_SEPARATED] [PEER_LB_IP]

export DEBIAN_FRONTEND=noninteractive

# 1. Update and Install Nginx and Keepalived
sudo apt-get update
sudo apt-get install -y nginx curl keepalived

# 2. Configure Keepalived for HA
INSTANCE_NAME=$(hostname)
PEER_IP=$2

# Path to config files (moved by deploy.sh)
SCRIPT_DIR_VAL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR_VAL/config.sh"

LB_VIP_VAL="$LB_VIP"

if [[ "$INSTANCE_NAME" == *"-01"* ]]; then
    ROLE="MASTER"
    PRIORITY=101
else
    ROLE="BACKUP"
    PRIORITY=100
fi

MY_IP=$(hostname -I | awk '{print $1}')

# Get interface name (usually ens4 on GCP)
INTERFACE=$(ip -o link show | awk -F': ' '$2 != "lo" {print $2; exit}')

sudo cp "$SCRIPT_DIR_VAL/check_nginx.sh" /usr/local/bin/check_nginx.sh
sudo chmod +x /usr/local/bin/check_nginx.sh

cat <<EOF | sudo tee /etc/keepalived/keepalived.conf
vrrp_script check_nginx {
    script "/usr/local/bin/check_nginx.sh"
    interval 2
    weight 2
}

vrrp_instance VI_1 {
    state $ROLE
    interface $INTERFACE
    virtual_router_id 51
    priority $PRIORITY
    advert_int 1
    unicast_src_ip $MY_IP
    unicast_peer {
        $PEER_IP
    }
    authentication {
        auth_type PASS
        auth_pass 42
    }
    virtual_ipaddress {
        $LB_VIP_VAL
    }
    track_script {
        check_nginx
    }
}
EOF

sudo systemctl restart keepalived

# 3. Configure Nginx Load Balancer
IPS=$(echo $1 | tr ',' ' ')
UPSTREAM_BLOCK=""
for IP in $IPS; do
    UPSTREAM_BLOCK+="    server $IP:8000;\n"
done

cat <<EOF | sudo tee /etc/nginx/sites-available/loadbalancer
upstream webapp_servers {
$(echo -e "$UPSTREAM_BLOCK")
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

sudo ln -sf /etc/nginx/sites-available/loadbalancer /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

# 4. Setup dynamic list for healthcheck script
sudo mkdir -p /etc/nginx/
echo "$1" | sudo tee /etc/nginx/webapp_ips.txt

# 5. Setup Healthcheck Script
sudo cp "$SCRIPT_DIR_VAL/lb_healthcheck.sh" /usr/local/bin/lb_healthcheck.sh
sudo chmod +x /usr/local/bin/lb_healthcheck.sh

# 6. Setup Cron Job (every minute)
echo "* * * * * root /usr/local/bin/lb_healthcheck.sh >> /var/log/lb_healthcheck.log 2>&1" | sudo tee /etc/cron.d/lb_healthcheck

echo "Load Balancer setup complete!"
