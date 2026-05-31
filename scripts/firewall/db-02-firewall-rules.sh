#!/bin/bash

sudo iptables -F

# 1. Tráfego interno
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A OUTPUT -o lo -j ACCEPT

# 2. Ligações ativas
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# 3. SSH (22): Apenas a partir da Admin VM
sudo iptables -A INPUT -p tcp -s 10.10.10.5 --dport 22 -j ACCEPT

# 4. Entrada SQL (5432): Apenas a partir da DB Primária (db-01) para replicação
sudo iptables -A INPUT -p tcp -s 10.10.10.30 --dport 5432 -j ACCEPT

# 5. Default DROP
sudo iptables -P INPUT DROP
sudo iptables -P OUTPUT DROP
sudo iptables -P FORWARD DROP