#!/bin/bash

# 1. Atualizar o sistema
sudo apt-get update && sudo apt-get upgrade -y

# 2. Instalar dependências básicas
sudo apt-get install -y ca-certificates curl gnupg lsb-release git

# 3. Configurar Repositório Oficial do Docker (Debian)
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Instalar Docker e Docker Compose Plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Configurar permissões (para não precisares de usar 'sudo' no docker)
# Nota: O utilizador padrão da GCP costuma ser o teu nome de conta Google
CURRENT_USER=$(whoami)
sudo usermod -aG docker $CURRENT_USER

# 6. Autenticar o Docker no Artifact Registry (Madrid)
# Isto permite que a VM puxe as tuas imagens privadas automaticamente
gcloud auth configure-docker europe-southwest1-docker.pkg.dev --quiet

# 7. Criar estrutura de pastas do projeto
mkdir -p ~/tuxy
cd ~/tuxy

# 8. (Opcional) Criar um ficheiro de verificação
echo "Setup TUXY completo em $(date)" > setup_status.txt