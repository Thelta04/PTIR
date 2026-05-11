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
*   **Trip Acceptance:** View pending trip requests and accept them to start a ride.
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
     React SPA (Vite)  <───API───>  Django REST API  <───SQL───>  PostgreSQL (v16)
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
                ┌──────┴──────┐
                │ Public IP   │  ← 34.175.164.1 (Floats via GCP API script)
                │   LB VIP    │  ← 10.10.10.100 (Keepalived / VRRP)
                └──────┬──────┘
                       │
           ┌───────────┴───────────┐
    ┌──────┴──────┐         ┌──────┴──────┐
    │   lb-01     │         │   lb-02     │
    │ 10.10.10.10 │         │ 10.10.10.11 │
    └──────┬──────┘         └──────┬──────┘
        (Master)                 (Backup)
           │                       │
           └───────────┬───────────┘
                       │
           ┌───────────┴───────────┐
           │                       │
    ┌──────┴──────┐         ┌──────┴──────┐
    │   web-1     │         │   web-2     │
    │ 10.10.10.20 │         │ 10.10.10.21 │
    └──────┬──────┘         └──────┬──────┘
           │  Nginx (:8000) → Gunicorn (:8001)
           │  Frontend SPA + Backend API
           │
    ┌──────┴──────┐         ┌──────┴──────┐
    │    db-01    │         │    db-02    │
    │ 10.10.10.30 │         │ 10.10.10.31 │
    └─────────────┘         └─────────────┘
       (Primary)               (Replica)
```

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
3.  **Scale Out (Add WebApp):** `bash scripts/infra/add_webapp.sh` (Creates a new webapp VM with the next available IP, then run `deploy_webapp.sh` and `deploy_lb.sh` to provision it)

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
├── scripts/            # GCP Automation & Healthchecks
│   ├── deploy/         # Modular Deployment Orchestrators
│   ├── healthchecks/   # HA Monitoring & Auto-Promotion
│   └── infra/          # GCP VM Provisioning
└── nginx/              # Production Proxy Configurations
```

## 📝 To Implement
* Avoid api polling to check trip status, use websocket instead.
* Add notifications for new trip requests.