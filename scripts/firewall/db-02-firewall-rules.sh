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
sudo iptables -A INPUT -p tcp -s 35.235.240.0/20 --dport 22 -j ACCEPT

# 4. Entrada SQL (5432)
sudo iptables -A INPUT -p tcp -m iprange --src-range 10.10.10.20-10.10.10.29 --dport 5432 -j ACCEPT
sudo iptables -A INPUT -p tcp -s 10.10.10.5 --dport 5432 -j ACCEPT

# 5. Default DROP
sudo iptables -P INPUT DROP
sudo iptables -P OUTPUT DROP
sudo iptables -P FORWARD DROP