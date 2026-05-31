#!/bin/bash

# Limpar regras antigas
sudo iptables -F

# 1. Tráfego interno
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A OUTPUT -o lo -j ACCEPT

# 2. Manter as ligações ativas para garantir respostas
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# 3. Entrada: Permitir tráfego Web da Internet (HTTP e HTTPS)
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# 4. Entrada: SSH (22) APENAS a partir da Admin VM (10.10.10.5) e IAP
sudo iptables -A INPUT -p tcp -s 10.10.10.5 --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp -s 35.235.240.0/20 --dport 22 -j ACCEPT

#5 Permite que o lb-01 e o lb-02 (10.10.10.11) comuniquem para saber qual está ativo
sudo iptables -A INPUT -p vrrp -s 10.10.10.11 -j ACCEPT
sudo iptables -A OUTPUT -p vrrp -d 10.10.10.11 -j ACCEPT

# 6. Saída: Enviar o tráfego Web para os Servidores Aplicacionais na porta 8000
sudo iptables -A OUTPUT -p tcp -m iprange --dst-range 10.10.10.20-10.10.10.29 --dport 8000 -j ACCEPT

# 7. Saída: Permitir DNS e HTTPS para a API da Google Cloud (gcloud)
sudo iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
sudo iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT
sudo iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT

# 8. Default DROP: Bloqueia tudo o que não foi explicitamente autorizado
sudo iptables -P INPUT DROP
sudo iptables -P OUTPUT DROP
sudo iptables -P FORWARD DROP