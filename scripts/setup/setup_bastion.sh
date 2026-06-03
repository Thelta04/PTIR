#!/bin/bash
# scripts/setup/setup_bastion.sh
# Runs ON the bastion VM to harden it for jump-server use.

set -e

echo "--- Bastion Setup: Installing security tools ---"

# Wait for any pending package operations
while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 2; done

export DEBIAN_FRONTEND=noninteractive
if ! dpkg -s fail2ban >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq fail2ban
fi

# SSH Hardening
echo "--- Hardening SSH ---"

SSHD_CONF="/etc/ssh/sshd_config"

# Disable root login
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' "$SSHD_CONF"

# Disable password auth (key-only)
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONF"

# Disable empty passwords
sudo sed -i 's/^#\?PermitEmptyPasswords.*/PermitEmptyPasswords no/' "$SSHD_CONF"

# Limit max auth tries
sudo sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 3/' "$SSHD_CONF"

# Idle timeout: disconnect after 5 min of inactivity
sudo sed -i 's/^#\?ClientAliveInterval.*/ClientAliveInterval 300/' "$SSHD_CONF"
sudo sed -i 's/^#\?ClientAliveCountMax.*/ClientAliveCountMax 0/' "$SSHD_CONF"

# Enable TCP forwarding (required for SSH tunneling to internal VMs)
sudo sed -i 's/^#\?AllowTcpForwarding.*/AllowTcpForwarding yes/' "$SSHD_CONF"

# Disable X11 forwarding
sudo sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' "$SSHD_CONF"

sudo systemctl restart sshd

# Fail2ban Configuration
echo "--- Configuring fail2ban ---"

sudo tee /etc/fail2ban/jail.local > /dev/null <<'EOF'
[sshd]
enabled  = true
port     = ssh
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 5
bantime  = 3600
findtime = 600
EOF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban

echo "--- Bastion setup complete ---"
