#!/bin/bash

# Limpar regras antigas
sudo iptables -F

# 1. Tráfego interno
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A OUTPUT -o lo -j ACCEPT

# 2. Ligações ativas
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# 3. Web (Internet): Preparado para assumir o tráfego se o lb-01 falhar
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# 4. SSH (22): Apenas Admin VM
sudo iptables -A INPUT -p tcp -s 10.10.10.5 --dport 22 -j ACCEPT

# 5. Sincronização VRRP: O lb-02 escuta e fala com o lb-01 (10.10.10.10)
sudo iptables -A INPUT -p vrrp -s 10.10.10.10 -j ACCEPT
sudo iptables -A OUTPUT -p vrrp -d 10.10.10.10 -j ACCEPT

# 6. Saída para Web VMs: Tráfego para as máquinas aplicacionais (8000)
sudo iptables -A OUTPUT -p tcp -m iprange --dst-range 10.10.10.20-10.10.10.29 --dport 8000 -j ACCEPT

# 7. Default DROP
sudo iptables -P INPUT DROP
sudo iptables -P OUTPUT DROP
sudo iptables -P FORWARD DROP