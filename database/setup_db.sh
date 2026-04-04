# ==========================================
# DATABASE ENGINE INSTALLATION
# ==========================================

# 1. Update the system
sudo apt update && sudo apt upgrade -y

# 2. Install PostgreSQL and extra tools
sudo apt install postgresql postgresql-contrib -y

# 3. Ensure the service starts automatically when the VM reboots
sudo systemctl enable postgresql
sudo systemctl start postgresql