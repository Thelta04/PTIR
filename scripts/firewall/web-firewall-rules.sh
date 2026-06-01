#!/bin/bash

# Limpar regras antigas
sudo iptables -F

# Tráfego interno da própria máquina
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A OUTPUT -o lo -j ACCEPT

# Manter as ligações ativas para garantir respostas
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Entrada: SSH (22) APENAS a partir da Admin VM (10.10.10.5) e IAP
sudo iptables -A INPUT -p tcp -s 10.10.10.5 --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp -s 35.235.240.0/20 --dport 22 -j ACCEPT

# Entrada: Receber tráfego Web (8000)
sudo iptables -A INPUT -p tcp -s 10.10.10.10 --dport 8000 -j ACCEPT # lb-01
sudo iptables -A INPUT -p tcp -s 10.10.10.11 --dport 8000 -j ACCEPT # lb-02
sudo iptables -A INPUT -p tcp -s 10.10.10.5 --dport 8000 -j ACCEPT # bastion

# Saída: Consultar a Base de Dados Primária/Replica (5432)
sudo iptables -A OUTPUT -p tcp -m iprange --dst-range 10.10.10.30-10.10.10.39 --dport 5432 -j ACCEPT

# Allow DNS (53) and HTTP/HTTPS for external APIs (Nominatim, OpenRouteService)
sudo iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
sudo iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT
sudo iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT

# Default DROP: Bloqueia
sudo iptables -P INPUT DROP
sudo iptables -P OUTPUT DROP
sudo iptables -P FORWARD DROP