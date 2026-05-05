# PTIR - Taxi Fleet Management System

Aplicação de gestão de frotas de táxis com deployment automatizado em Google Cloud Platform (GCP).

## Estrutura do Projeto

```
├── backend/            # API Django REST Framework (core + api app)
├── frontend/           # Aplicação React + Vite (SPA)
├── database/           # Scripts SQL (schema.sql, inserts.sql)
├── scripts/            # Scripts de automação de infraestrutura
│   ├── common/         # Configurações e utilitários partilhados
│   ├── deploy/         # Orquestradores de deployment modulares
│   ├── healthchecks/   # Scripts de monitorização e saúde
│   ├── infra/          # Gestão de VMs e verificação de arquitetura
│   ├── setup/          # Provisionamento inicial de componentes
│   └── misc/           # Scripts auxiliares (ex: auto-replacement)
└── .env                # Variáveis de ambiente (credenciais, config)
```

---

## Arquitetura de Deployment

A infraestrutura segue uma arquitetura em camadas com redundância:

```
                    Internet
                       │
                ┌──────┴──────┐
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

### Componentes

| VM | IP Interno | Função | Software |
|:---|:-----------|:-------|:---------|
| `VIP` | 10.10.10.100 | Entry point flutuante | Keepalived (VRRP) |
| `lb-01` | 10.10.10.10 | Load Balancer (Master) | Nginx + Keepalived |
| `lb-02` | 10.10.10.11 | Load Balancer (Backup) | Nginx + Keepalived |
| `web-1` | 10.10.10.20 | Webapp | Nginx + Gunicorn |
| `web-2` | 10.10.10.21 | Webapp | Nginx + Gunicorn |
| `db-01` | 10.10.10.30 | DB (Primária) | PostgreSQL |
| `db-02` | 10.10.10.31 | DB (Backup/Replica) | PostgreSQL |

---

## Alta Disponibilidade (HA) e Resiliência

O sistema implementa vários mecanismos para garantir continuidade de serviço:

### 1. Load Balancer Failover (Keepalived)
Utiliza o protocolo **VRRP** via **Keepalived** para gerir um **IP Virtual (VIP) 10.10.10.100**.
- **lb-01 (MASTER):** Assume o VIP por defeito.
- **lb-02 (BACKUP):** Monitoriza o Master. Se o Master falhar (VM em baixo ou processo Nginx parado via `check_nginx.sh`), o Backup assume o VIP instantaneamente.

### 2. Database Failover (Auto-Promotion)
As bases de dados operam num modelo Primária-Réplica. O script `db_healthcheck.sh` corre na réplica e:
1. Verifica se a réplica consegue comunicar com a primária.
2. Se a primária estiver inacessível após várias tentativas, a réplica executa `pg_promote()` para se tornar a nova Primária.

### 3. Auto-Replacement de Nós
O script `auto_replace_node.sh` permite a substituição automática de instâncias falhadas.
- Deteta falhas em qualquer tipo de nó (`lb`, `db`, `web`).
- Provisiona uma nova instância com a configuração correta (IP estático, tags de rede, tipo de máquina).

---

## Como Fazer o Deployment

### Pré-requisitos

- **Google Cloud SDK** (`gcloud`) instalado e autenticado
- **Node.js/npm** instalado localmente (para compilar o frontend)
- Ficheiro `.env` configurado na raiz do projeto

### 1. Criar as VMs (apenas na primeira vez)

```bash
bash scripts/infra/create_vms.sh
```

### 2. Deployment Modular

Agora é possível fazer o deployment de componentes individuais:

*   **Tudo:** `bash scripts/deploy/deploy_all.sh`
*   **Base de Dados:** `bash scripts/deploy/deploy_db.sh`
*   **WebApp (Backend + Frontend):** `bash scripts/deploy/deploy_webapp.sh`
*   **Load Balancer:** `bash scripts/deploy/deploy_lb.sh`

O script `deploy_all.sh` orquestra o deployment completo na ordem correta: DB → WebApp → LB.

---

## Estrutura de Scripts

| Script | Localização | Função |
|:-------|:------------|:-------|
| `config.sh` | `scripts/common/` | Configurações centralizadas (Project ID, IPs, Tags) |
| `utils.sh` | `scripts/common/` | Funções utilitárias (remote_exec, remote_scp) |
| `deploy_all.sh` | `scripts/deploy/` | Orquestra o deployment completo |
| `deploy_db.sh` | `scripts/deploy/` | Deploy exclusivo da camada de dados |
| `deploy_webapp.sh` | `scripts/deploy/` | Build frontend + deploy backend (rolling update) |
| `deploy_lb.sh` | `scripts/deploy/` | Configuração/Atualização dos load balancers |
| `setup_db.sh` | `scripts/setup/` | Provisionamento do PostgreSQL remoto |
| `setup_webapp.sh` | `scripts/setup/` | Provisionamento do Gunicorn+Nginx remoto |
| `setup_lb.sh` | `scripts/setup/` | Provisionamento do Nginx+Keepalived remoto |
| `lb_healthcheck.sh`| `scripts/healthchecks/` | Healthcheck dinâmico de webapps (cron) |
| `db_healthcheck.sh`| `scripts/healthchecks/` | Monitorização e auto-promotion de DB |
| `check_nginx.sh` | `scripts/healthchecks/` | Verificação de processo para o Keepalived |
| `create_vms.sh` | `scripts/infra/` | Criação das instâncias no GCP |
| `verify_architecture.sh`| `scripts/infra/` | Suite de testes de arquitetura e failover |
| `auto_replace_node.sh`| `scripts/misc/` | Provisionamento de nós de substituição |

---

## Contas de Teste

| Papel | Email | Password |
|:------|:------|:---------|
| **Driver** | `joao@email.com` | `Joao123` |
| **Client** | `maria@email.com` | `Maria123` |
| **Manager** | `carlos@email.com` | `Carlos123` |

---

## Notas Importantes

1. **Acesso SSH:** Todas as VMs usam IAP (Identity-Aware Proxy):
   ```bash
   gcloud compute ssh <vm-name> --tunnel-through-iap
   ```
2. **Logs de Healthcheck:**
   - LB: `/var/log/lb_healthcheck.log`
   - DB: `/var/log/db_healthcheck.log`
