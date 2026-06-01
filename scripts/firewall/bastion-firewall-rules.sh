#!/bin/bash
# scripts/firewall/bastion-firewall-rules.sh
# Firewall rules for the bastion (jump server) VM.
# Only allows inbound SSH from the internet and outbound SSH to the internal network.

# Limpar regras antigas
sudo iptables -F

# 1. Tráfego interno (loopback)
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A OUTPUT -o lo -j ACCEPT

# 2. Manter as ligações ativas para garantir respostas
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# 3. Entrada: SSH (22) a partir da Internet (ponto de entrada administrativo)
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# 4. Saída: Tráfego administrativo para a rede interna (22, 80, 443, 8000, 5432)
sudo iptables -A OUTPUT -p tcp -d 10.10.10.0/24 -m multiport --dports 22,80,443,8000,5432 -j ACCEPT

# 5. Saída: DNS (necessário para resolução de nomes durante apt-get, etc.)
sudo iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
sudo iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# 6. Saída: HTTP/HTTPS (necessário para apt-get update/install)
sudo iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT

# 7. Default DROP: Bloqueia tudo o que não foi explicitamente autorizado
sudo iptables -P INPUT DROP
sudo iptables -P OUTPUT DROP
sudo iptables -P FORWARD DROP
