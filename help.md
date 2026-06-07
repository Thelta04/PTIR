# Google Cloud VPC Firewall Rules Explanation

This document provides a comprehensive breakdown of the Google Cloud VPC firewall rules currently active in your `lan` network. 

Google Cloud VPC Firewalls are **stateful**. This means if an ingress (incoming) connection is allowed, the return egress (outgoing) traffic for that connection is automatically allowed, and vice versa.

The rules follow a **priority system**, where a lower number means a higher priority. Egress deny rules are set to `900`, meaning our specific allow rules at `800` will override them.

---

## 🔒 1. Global Restrictions (The "Deny All" Rules)
To ensure that no server accidentally communicates with the internet without explicit permission, you have a set of "Deny All" egress rules applied to every server tier. They block everything (`0.0.0.0/0`) at priority `900`:

*   `deny-webapp-server-egress-internet`: Blocks Web Servers from reaching the internet.
*   `deny-db-server-egress-internet` / `deny-db-egress-internet`: Blocks Database Servers from reaching the internet.
*   `deny-lb-server-egress-internet`: Blocks Load Balancers from reaching the internet.
*   `deny-bastion-server-egress-internet`: Blocks Bastion Host from reaching the internet.

Because these rules exist, we must explicitly create `ALLOW` rules (with priority `800`) to punch holes in the firewall for necessary traffic.

---

## 🌐 2. Load Balancer Rules (Target: `lb-server`)

**INGRESS (Incoming):**
*   `allow-lb-ingress-web` (`tcp:80, tcp:443`): This allows anyone on the public internet to access your website via HTTP and HTTPS.
*   `allow-lb-ingress-ssh` (`tcp:22`): Allows SSH into the load balancer (likely restricted further by IAP/Bastion rules).

**EGRESS (Outgoing):**
*   `allow-lb-egress-internal` (`tcp:8000`): **(The rule I just created!)** Allows the Load Balancer to forward web traffic to the internal Web Application servers on port 8000.
*   `allow-lb-egress-https` (`tcp:443`): Allows the Load Balancer to reach the internet for HTTPS requests (e.g., to verify SSL certificates, connect to Google APIs).

---

## 💻 3. Web Application Rules (Target: `webapp-server`)

**INGRESS (Incoming):**
*   `allow-web-ingress-http` / `allow-internal-app` (`tcp:8000`): Allows the Web Servers to accept incoming web traffic. Since they don't have public IPs, this primarily allows the Load Balancer to reach them.
*   `allow-web-ingress-ssh` (`tcp:22`): Allows SSH connections into the web servers (from the Bastion).

**EGRESS (Outgoing):**
*   `allow-web-egress-internal` (`tcp:5432`): Allows the Web Servers to query the Database Servers on the standard PostgreSQL port. *(Note: This strictly blocks them from SSHing into other machines, preventing lateral movement!)*
*   `allow-web-egress-https` (`tcp:443`): Allows the Web Servers to make outbound HTTPS calls to the internet (necessary for Nominatim, OpenRouteService, etc.).

---

## 🗄️ 4. Database Rules (Target: `db-server`)

**INGRESS (Incoming):**
*   `allow-db-ingress-sql` / `allow-internal-db` (`tcp:5432`): Allows the database to accept incoming SQL queries from the Web Servers.
*   `allow-db-ingress-ssh` (`tcp:22`): Allows SSH connections into the database servers (from the Bastion).

**EGRESS (Outgoing):**
*   `allow-db-egress-internal` (`tcp:5432`): Allows the database to make internal connections. We recently removed `tcp:22` from this rule to patch the SSH lateral movement vulnerability. It now strictly allows database replication traffic to the secondary DB.
*   `allow-db-egress-metadata` (`tcp:80`): Allows the DB to fetch its own metadata from Google Cloud's internal metadata server (used for OS Login and SSH keys).

---

## 🛡️ 5. Bastion Host Rules (Target: `bastion-server`)

**INGRESS (Incoming):**
*   `allow-bastion-ingress-ssh` / `allow-ssh-bastion` (`tcp:22`): Allows you to SSH into the Bastion from the public internet.

**EGRESS (Outgoing):**
*   `allow-bastion-egress-internal` (`tcp:22,80,443,8000,5432`): The Bastion is the administrative "Jump Server", so it needs broad access to reach every internal machine on their respective ports.
*   `allow-bastion-egress-http-https` (`tcp:80,443`): Allows the Bastion to download packages and updates from the internet.

---

## 🔧 6. Global Shared Rules

*   `allow-ssh-iap` (`tcp:22`): Allows Google's Identity-Aware Proxy (IAP) IP range (`35.235.240.0/20`) to SSH into the VMs securely without needing public IPs.
*   `allow-egress-dns` (`tcp:53, udp:53`): Ensures VMs can resolve domain names (like `google.com` or `tuxy.pt`) by explicitly allowing DNS traffic.
*   `allow-all-egress-metadata` (`tcp:80`): Allows all servers to query `169.254.169.254` (Google's metadata server), which is critical for startup scripts and SSH key management.
*   `lan-allow-http` / `lan-allow-https`: Broad/legacy rules allowing port 80/443 on the `lan` network.
