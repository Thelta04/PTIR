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

## Desenvolvimento Local
### Backend

```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

### Frontend

O Vite faz proxy de pedidos `/api` para `localhost:8000` (Django), evitando problemas de CORS.

```bash
cd frontend
npm install
npm run dev
```

Frontend acessível em `http://localhost:5173/`.

---

## Documentação da API (Swagger)

O projeto usa `drf-spectacular` para gerar documentação OpenAPI automaticamente.

Com o servidor a correr:
- **Swagger UI:** `http://<host>/api/docs/`
- **Schema Raw:** `http://<host>/api/schema/`

---

## Contas de Teste

Após o deployment (com `inserts.sql` aplicado):

| ID | Papel | Nome | Email | Password |
|:---|:------|:-----|:------|:---------|
| 1 | **Driver** | João Silva | `joao@email.com` | `Joao123` |
| 2 | **Driver** | Pedro Santos | `pedro@email.com` | `Pedro123` |
| 3 | **Client** | Maria Costa | `maria@email.com` | `Maria123` |
| 4 | **Client** | Ana Ferreira | `ana@email.com` | `Ana123` |
| 5 | **Manager** | Carlos Mendes | `carlos@email.com` | `Carlos123` |

Adicionalmente, existem 4 viagens de teste com o estado `PENDING` criadas no ficheiro `inserts.sql` para testar a atribuição a motoristas (incluindo a ordenação por distância).

---

## Autenticação JWT (Endpoints de Manager)

Endpoints de gestão são protegidos com JWT. Clients e Drivers **não** usam tokens.

### Fluxo

1. **Login** — `POST /api/auth/login/` com `email` + `password`. Managers recebem tokens `access` e `refresh`.
2. **Usar o token** — incluir `Authorization: Bearer <access_token>` nos headers.
3. **Refresh** — quando o access token expira (30 min), chamar `POST /api/auth/token/refresh/` com o `refresh` token. Refresh tokens duram 7 dias.

### Endpoints Protegidos

| Método | Endpoint | Descrição |
|:-------|:---------|:----------|
| POST | `/api/taxi/create/` | Criar um novo táxi |
| POST | `/api/shift/create/` | Criar um novo turno |
| DELETE | `/api/shift/<id>/delete/` | Apagar um turno |
| PATCH | `/api/user/<id>/toggle-status/` | Banir / desbanir utilizador |

### Exemplo (cURL)

```bash
# 1. Login como manager
curl -X POST http://<host>/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "carlos@email.com", "password": "Carlos123"}'

# 2. Usar access token num endpoint protegido
curl -X POST http://<host>/api/taxi/create/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"license_plate": "XX-99-YY", ...}'

# 3. Refresh de um access token expirado
curl -X POST http://<host>/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh_token>"}'
```

---

## Notas Importantes

1. **Schema da BD:** O PostgreSQL usa naming conventions específicas (e.g., `id_scheduled_interval`, `id_taxi`). Ao modificar modelos Django com ForeignKey, especificar **sempre** `db_column` (e.g., `db_column='id_taxi'`).
2. **Convenção de Endpoints:** A API usa **nomenclatura singular** (e.g., `/api/driver/`, `/api/taxi/`, `/api/shift/`).
3. **Listagem de Viagens:** O endpoint `GET /api/trip/` suporta os query parameters `lat`, `lon`, `comfort_level`, `num_passengers` e `driver_id`. 
   - `lat` e `lon`: Quando fornecidos (juntamente com `status=PENDING`), a API calcula a distância em linha reta (fórmula de Haversine) entre as coordenadas dadas e a origem da viagem, ordenando os resultados por proximidade. (Exemplo: http://localhost:5173/api/trip/?status=PENDING&lat=38.7223&lon=-9.1393)
   - `comfort_level`: Filtra por nível de conforto (ex: `basic` ou `luxury`).
   - `num_passengers`: Filtra viagens que tenham um número de passageiros menor ou igual ao indicado.
   - `driver_id`: Alternativamente, pode ser fornecido o ID do motorista. Se fornecido, a API irá procurar o turno ativo desse motorista e filtrar automaticamente as viagens que caibam na lotação (`num_passengers`) do seu táxi atual e conforme o nível de conforto (`comfort_level`).
4. **Banning:** Qualquer utilizador pode ser banido por um Manager. Um utilizador banido falha a autenticação no endpoint `/auth/login/`.
5. **CORS:** Não é necessário `django-cors-headers`. Em desenvolvimento o Vite faz proxy, e em produção o Nginx trata do routing.
6. **Acesso SSH às VMs:** Todas as VMs usam IAP (Identity-Aware Proxy), não é necessário expor a porta 22:
   ```bash
   gcloud compute ssh <vm-name> --project="project-dc8596f3-77e8-4941-a9a" \
       --zone="europe-southwest1-c" --tunnel-through-iap
   ```
