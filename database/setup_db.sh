# ==========================================
# INSTALAÇÃO DO MOTOR DE BASE DE DADOS
# ==========================================

# 1. Atualizar o sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar o PostgreSQL e ferramentas extra
sudo apt install postgresql postgresql-contrib -y

# 3. Garantir que o serviço arranca sempre que a VM reiniciar
sudo systemctl enable postgresql
sudo systemctl start postgresql