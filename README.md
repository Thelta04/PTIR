# Tuxy - Taxi Fleet Management System

**Tuxy** is a comprehensive, high-availability platform designed for managing taxi fleets. It seamlessly connects clients seeking rides with drivers, while providing fleet managers with powerful administrative tools. The system is built for resilience, with an automated deployment pipeline on Google Cloud Platform (GCP) ensuring 24/7 service availability.

---

## 🚀 Key Features by User Role

### 👤 Client Dashboard
*   **Request Rides:** Clients can request trips by specifying origin/destination addresses (converted via geocoding) and number of passengers.
*   **Trip Customization:** Filter by comfort levels (**Basic** or **Luxury**).
*   **Real-time Matching:** The system matches clients with the nearest available driver based on the Haversine formula.
*   **Trip History:** Access a full record of past trips, including distances and costs.
*   **Ratings:** Provide feedback by rating completed trips (1-5 stars).

### 🚖 Driver Portal
*   **Shift Management:** Drivers manage their active shifts. For safety, the system enforces a strict **maximum of 8 hours** per shift (real and scheduled).
*   **Trip Acceptance:** View pending trip requests and accept them to start a ride. Includes an automatic 60-second timeout while waiting for the client's confirmation.
*   **Refueling Logs:** Register refueling events (liters for combustion engines, kWh for electric) directly during their shift.
*   **Dynamic Matching:** Drivers only receive trip requests that match their vehicle's capacity and comfort level.

### 💼 Manager Dashboard
*   **Fleet Oversight:** Create and manage the taxi fleet (adding new vehicles, tracking mileage, etc.).
*   **User Management:** Overview of all clients and drivers. Managers can **ban/unban** users to maintain system integrity.
*   **Shift Scheduling:** Coordinate and monitor driver shifts across the fleet.

---

## 🏗 System Architecture

The application is structured into three main layers, ensuring modularity and scalability:

```text
       [ FRONTEND ]                  [ BACKEND ]                  [ DATABASE ]
     React SPA (Vite)  <---API--->  Django REST API  <---SQL--->  PostgreSQL (v16)
    (Nginx / Vite Proxy)          (Gunicorn / DRF)            (Triggers & Logic)
```

### Frontend-Backend Integration
*   **Local Development:** Vite uses a proxy to route `/api` calls to the Django server running on port 8000.
*   **Production:** Nginx acts as a reverse proxy, serving the compiled React static files and forwarding API requests to the Backend container.
*   **Authentication:** Managers use **JWT (JSON Web Tokens)** for secure administrative access, while Clients and Drivers use simplified session-based flows.

---

## 🛡 High Availability (HA) & Resiliência

The infrastructure is designed for maximum uptime on GCP using a multi-layered redundancy strategy:

### 1. Load Balancer Failover (Keepalived & GCP API)
Utilizes the **VRRP** protocol via **Keepalived** to manage high availability at two layers:
- **Internal VIP (`10.10.10.100`):** Managed natively by Keepalived via gratuitous ARP for internal network failover.
- **External Public IP (`34.175.164.1`):** Managed via a custom Keepalived `notify_master.sh` script that hooks into the **Google Cloud API**. When a node is promoted to MASTER, it actively detaches the external IP from its peer and attaches it to its own network interface, ensuring seamless browser failover for external users.
- **lb-01 (MASTER):** Primary entry point.
- **lb-02 (BACKUP):** Automatically assumes the VIP and External IP if the Master fails (VM down or Nginx process stopped).

### 2. Database Failover (Auto-Promotion)
The database operates in a **Primary-Replica** model. A custom `db_healthcheck.sh` script monitors the primary; if it becomes unreachable, the replica is automatically promoted to Primary (`pg_promote()`).

### 3. Architecture Overview

```text
                    Internet
                       │
          ┌────────────┼────────────┐
          │            │            │
   ┌──────┴──────┐     │     ┌──────┴──────┐
   │  bastion    │     │     │ Public IP   │  ← 34.175.164.1
   │ 10.10.10.5  │     │     │   LB VIP    │  ← 10.10.10.100
   │ (Jump Host) │     │     └──────┬──────┘
   └──────┬──────┘     │            │
     SSH mgmt ─────────┼────────────┤
          │            │            │
          │   ┌--------┴-------┐    │
          │   │                │    │
          │ ┌─┴──────────┐ ┌──┴────┴─────┐
          │ │   lb-01     │ │   lb-02     │
          ├→│ 10.10.10.10 │ │ 10.10.10.11 │
          │ └──────┬──────┘ └──────┬──────┘
          │     (Master)        (Backup)
          │        └───────┬───────┘
          │                │
          │   ┌────────────┴────────────┐
          │   │                         │
          │ ┌─┴──────────┐   ┌──────────┴─┐
          │ │   web-1     │   │   web-2     │
          ├→│ 10.10.10.20 │   │ 10.10.10.21 │
          │ └──────┬──────┘   └──────┬──────┘
          │  Nginx (:8000) → Gunicorn (:8001)
          │        Frontend + Backend
          │        │                 |
          │ ┌──────┴──────┐   ┌──────┴───────┐
          │ │    db-01    │   │    db-02     │
          └→│ 10.10.10.30 │   │ 10.10.10.31  │
            └─────────────┘   └──────────────┘
               (Primary)          (Replica)
```

### 4. Bastion Host (Jump Server)
A hardened **bastion VM** (`10.10.10.5`) is the single SSH entry point to the entire private network. All internal VMs drop SSH traffic from any source other than the bastion.
- **Static External IP:** Reserved via GCP, allowing stable `~/.ssh/config` entries.
- **SSH Hardening:** Root login disabled, key-only authentication, idle timeout (5 min), max 3 auth tries.
- **Fail2ban:** Bans IPs after 5 failed attempts for 1 hour.
- **Firewall (iptables):** Only inbound SSH and outbound SSH to `10.10.10.0/24` are permitted; everything else is dropped.
- **SSH Tunneling:** Use `ssh -J` (ProxyJump) to reach any internal VM transparently.

---

## ⚙️ Data Integrity & Business Rules

Unlike standard applications, Tuxy enforces critical business logic directly at the database level using **SQL Triggers** to ensure consistency even if API calls bypass standard flows:

- **RIA 2 & 28:** Shifts are strictly limited to 8 hours. Ratings are only permitted for `COMPLETED` trips.
- **RIA 3:** Every trip must be perfectly contained within the time bounds of the assigned shift.
- **RIA 5:** A taxi cannot be used in a shift if its purchase year is later than the shift date.
- **RIA 22-25:** Strict validation for refueling data (positive costs, mileage increments, and fuel types).

---

## 🛠 Deployment & Development

### Local Setup

**Backend (Django):**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r backend_req.txt
python manage.py runserver
```

**Frontend (React/Vite):**
```bash
cd frontend
npm install
npm run dev
```

### GCP Deployment

1.  **Create VMs:** `bash scripts/infra/create_vms.sh`
2.  **Deploy Stack:** `bash scripts/deploy/deploy_all.sh` (Orchestrates DB → WebApp → LB)

### Automation Scripts (§3.1)

Scripts para demonstração e gestão da infraestrutura, executados a partir do diretório raiz do projeto.

**Bastion (Jump Server):**
| Script | Descrição |
|:---|:---|
| `bash scripts/create_bastion.sh` | Cria o bastion host (10.10.10.5) com IP externo estático, hardening SSH e fail2ban |

**Servidores Aplicacionais:**
| Script | Descrição |
|:---|:---|
| `bash scripts/create_app_server.sh` | Cria nova instância de servidor aplicacional, deploya a app e o LB descobre-a automaticamente |
| `bash scripts/kill_app_server.sh <nome>` | Termina uma instância específica (e.g. `web-2`). O LB deteta automaticamente |

**Base de Dados:**
| Script | Descrição |
|:---|:---|
| `bash scripts/create_db_primary.sh` | Cria e inicia a BD principal (db-01) |
| `bash scripts/create_db_backup.sh` | Cria e inicia a BD de reserva (db-02) como réplica |
| `bash scripts/kill_db_primary.sh` | Termina a BD principal. A réplica auto-promove-se |
| `bash scripts/promote_db_backup.sh` | Promove manualmente db-02 a primária |

**Balanceadores de Carga:**
| Script | Descrição |
|:---|:---|
| `bash scripts/create_lb.sh` | Cria LB1 (ativo) com IP público estático |
| `bash scripts/create_lb_backup.sh` | Cria LB2 (passivo) |
| `bash scripts/kill_lb_primary.sh` | Para o Nginx no LB1. Keepalived promove LB2 automaticamente |
| `bash scripts/promote_lb_backup.sh` | Reatribui o IP público estático para LB2 |

---

## 📖 API Documentation

The project uses `drf-spectacular` for automatic OpenAPI schema generation.
- **Swagger UI:** `http://<host>/api/docs/`
- **Schema Raw:** `http://<host>/api/schema/`

### Example: Manager Login (JWT)
```bash
curl -X POST http://<host>/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "carlos@email.com", "password": "Carlos123"}'
```

---

## 🧪 Test Accounts

| Role | Email | Password |
|:---|:---|:---|
| **Driver** | `joao@email.com` | `Joao123` |
| **Client** | `maria@email.com` | `Maria123` |
| **Manager** | `carlos@email.com` | `Carlos123` |

---

## 📁 Project Structure

```
├── backend/            # Django REST Framework API
├── frontend/           # React + Vite SPA
├── database/           # PostgreSQL Schema & SQL Logic
├── scripts/            # Automation Scripts
│   ├── create_bastion.sh
│   ├── create_app_server.sh
│   ├── kill_app_server.sh
│   ├── create_db_primary.sh
│   ├── create_db_backup.sh
│   ├── kill_db_primary.sh
│   ├── promote_db_backup.sh
│   ├── create_lb.sh
│   ├── create_lb_backup.sh
│   ├── kill_lb_primary.sh
│   ├── promote_lb_backup.sh
│   ├── tests/          # Vulnerability & architecture tests
│   │   ├── verify_architecture.sh
│   │   └── vulnerability_test.sh
│   ├── common/         # Shared config & utilities
│   ├── deploy/         # Modular Deployment Orchestrators
│   ├── firewall/       # Per-VM iptables rules
│   ├── healthchecks/   # HA Monitoring & Auto-Promotion
│   ├── infra/          # GCP VM Provisioning
│   └── setup/          # On-VM setup scripts
└── nginx/              # Production Proxy Configurations
```

## Good to Remember

### Checking Connected IPs via SSH

If you need to see who has connected to a server (or check for failed login attempts), you can run the following commands while logged into that server:

* **See all successful logins (Recent):**
  ```bash
  last -i
  ```
  *(The `-i` flag forces it to show IP addresses instead of hostnames).*

* **See all failed login attempts (Recent):**
  ```bash
  sudo lastb -i
  ```

* **Get a clean list of all IPs that successfully connected via SSH:**
  ```bash
  sudo grep "Accepted" /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -nr
  ```

* **Get a list of all IPs that failed to authenticate:**
  ```bash
  sudo grep "Disconnected from authenticating user" /var/log/auth.log | awk '{print $11}' | sort | uniq
  ```

### Service Status (run on each VM)

* **Check if Nginx, Gunicorn, PostgreSQL, or Keepalived are running:**
  ```bash
  sudo systemctl status nginx
  sudo systemctl status gunicorn
  sudo systemctl status postgresql
  sudo systemctl status keepalived
  ```

* **Check which ports are listening:**
  ```bash
  sudo ss -tulpn
  ```

### Database Replication

* **Check if a DB node is Primary or Replica:**
  ```bash
  sudo -u postgres psql -c "SELECT pg_is_in_recovery();"
  # t = Replica, f = Primary
  ```

* **On the Primary — see connected replicas:**
  ```bash
  sudo -u postgres psql -c "SELECT client_addr, state, sent_lsn, replay_lsn FROM pg_stat_replication;"
  ```

* **On the Replica — see replication receiver status:**
  ```bash
  sudo -u postgres psql -c "SELECT sender_host, status, received_lsn FROM pg_stat_wal_receiver;"
  ```

### Load Balancer & Keepalived

* **Check which LB currently holds the VIP (`10.10.10.100`):**
  ```bash
  ip addr show | grep 10.10.10.100
  ```

* **Check Keepalived state:**
  ```bash
  sudo journalctl -u keepalived --no-pager -n 20
  ```

* **See the current Nginx upstream servers:**
  ```bash
  cat /etc/nginx/sites-available/tuxy.pt | grep "server 10"
  ```

* **Check the LB healthcheck log:**
  ```bash
  sudo tail -f /var/log/lb_healthcheck.log
  ```

### Firewall

* **View current iptables rules:**
  ```bash
  sudo iptables -L -n -v --line-numbers
  ```

### Quick Verification Commands (run from your machine or bastion)

* **Verify LB is distributing traffic (check X-Served-By):**
  ```bash
  for i in {1..10}; do curl -sk https://tuxy.pt/ -o /dev/null -D - 2>/dev/null | grep X-Served-By; done
  ```

* **Check HTTPS and TLS version:**
  ```bash
  curl -vsk https://tuxy.pt/ -o /dev/null 2>&1 | grep -E "SSL connection|TLSv"
  ```

* **Check HTTP→HTTPS redirect:**
  ```bash
  curl -sI http://tuxy.pt/ | head -3
  ```

* **Check API health:**
  ```bash
  curl -sk https://tuxy.pt/api/check/
  ```

### Logs (tail in real-time during demo)

* **Keepalived failover log (on LB VMs):**
  ```bash
  sudo tail -f /var/log/keepalived_notify.log
  ```

* **DB healthcheck log (on db-02):**
  ```bash
  sudo tail -f /var/log/db_healthcheck.log
  ```

* **Nginx access/error logs:**
  ```bash
  sudo tail -f /var/log/nginx/access.log
  sudo tail -f /var/log/nginx/error.log
  ```

* **Fail2ban status on bastion:**
  ```bash
  sudo fail2ban-client status sshd
  ```