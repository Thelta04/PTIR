#!/bin/bash
# scripts/setup_lb.sh
# Usage: ./setup_lb.sh [INITIAL_WEBAPP_IPS_COMMA_SEPARATED]

export DEBIAN_FRONTEND=noninteractive

# 1. Update and Install Nginx
sudo apt-get update
sudo apt-get install -y nginx curl

# 2. Configure Nginx Load Balancer
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
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/loadbalancer /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

# 3. Setup dynamic list for healthcheck script
sudo mkdir -p /etc/nginx/
echo "$1" | sudo tee /etc/nginx/webapp_ips.txt

# 4. Setup Healthcheck Script
sudo cp /home/athen/app/scripts/lb_healthcheck.sh /usr/local/bin/lb_healthcheck.sh
sudo chmod +x /usr/local/bin/lb_healthcheck.sh

# 5. Setup Cron Job (every minute)
echo "* * * * * root /usr/local/bin/lb_healthcheck.sh >> /var/log/lb_healthcheck.log 2>&1" | sudo tee /etc/cron.d/lb_healthcheck

echo "Load Balancer setup complete!"
