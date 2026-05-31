#!/bin/bash

# Limpar regras antigas
sudo iptables -F

# 1. Tráfego interno da própria máquina
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A OUTPUT -o lo -j ACCEPT

# 2. Manter as ligações ativas para garantir respostas
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# 3. Entrada: SSH (22) APENAS a partir da Admin VM (10.10.10.5)
sudo iptables -A INPUT -p tcp -s 10.10.10.5 --dport 22 -j ACCEPT

# 4. Entrada: Receber tráfego Web (8000)
sudo iptables -A INPUT -p tcp -s 10.10.10.10 --dport 8000 -j ACCEPT # lb-01
sudo iptables -A INPUT -p tcp -s 10.10.10.11 --dport 8000 -j ACCEPT # lb-02

# 5. Saída: Consultar a Base de Dados Primária (5432)
sudo iptables -A OUTPUT -p tcp -d 10.10.10.30 --dport 5432 -j ACCEPT

# 6. Default DROP: Bloqueia
sudo iptables -P INPUT DROP
sudo iptables -P OUTPUT DROP
sudo iptables -P FORWARD DROP