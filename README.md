# PTIR - Taxi Fleet Management System

Aplicação de gestão de frotas de táxis com deployment automatizado em Google Cloud Platform (GCP).

## Estrutura do Projeto

```
├── backend/            # API Django REST Framework (core + api app)
├── frontend/           # Aplicação React + Vite (SPA)
├── database/           # Scripts SQL (schema.sql, inserts.sql)
├── scripts/            # Scripts de automação de infraestrutura
│   ├── create_vms.sh           # Criação das VMs no GCP
│   ├── deploy.sh               # Script principal de deployment
│   ├── setup_db.sh             # Setup do PostgreSQL nas VMs de BD
│   ├── setup_webapp.sh  # Setup do backend+frontend nas VMs web
│   ├── setup_lb.sh             # Setup do Nginx load balancer
│   └── lb_healthcheck.sh       # Healthcheck dinâmico (cron job)
└── .env                # Variáveis de ambiente (credenciais, config)
```

---

## Arquitetura de Deployment

A infraestrutura segue uma arquitetura em camadas com redundância:

```
                    Internet
                       │
                ┌──────┴──────┐
                │   lb-01     │  ← Nginx Load Balancer (porta 80)
                │ 10.10.10.10 │
                └──────┬──────┘
                       │ lb-02 (10.10.10.11)
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
    ┌──────┴──────┐
    │    db-01    │  ← PostgreSQL (porta 5432)
    │ 10.10.10.30 │
    └─────────────┘
      db-02 (10.10.10.31)
```

### Componentes

| VM | IP Interno | Função | Software |
|:---|:-----------|:-------|:---------|
| `lb-01` | 10.10.10.10 | Load Balancer primário | Nginx (porta 80) |
| `lb-02` | 10.10.10.11 | Load Balancer backup | Nginx (porta 80) |
| `web-1` | 10.10.10.20 | Webapp (API + Frontend) | Nginx (:8000) + Gunicorn (:8001) |
| `web-2` | 10.10.10.21 | Webapp (API + Frontend) | Nginx (:8000) + Gunicorn (:8001) |
| `db-01` | 10.10.10.30 | Base de dados primária | PostgreSQL (:5432) |
| `db-02` | 10.10.10.31 | Base de dados backup | PostgreSQL (:5432) |

### Fluxo de um Pedido

1. O utilizador acede ao IP externo do load balancer (porta 80)
2. O **Nginx do LB** distribui o pedido para um dos servidores web (`web-1` ou `web-2`) na porta 8000
3. O **Nginx da webapp** serve ficheiros estáticos do frontend (SPA React) diretamente, ou faz proxy de pedidos `/api/` e `/admin/` para o Gunicorn na porta 8001
4. O **Gunicorn** executa a aplicação Django que comunica com o PostgreSQL em `10.10.10.30:5432`

### Healthcheck Dinâmico

O load balancer executa um **cron job a cada minuto** (`lb_healthcheck.sh`) que:
1. Faz `curl` ao endpoint `/api/check/` de cada webapp
2. Remove servidores que não respondem da configuração do Nginx
3. Faz `reload` do Nginx apenas se a configuração mudou (comparação por MD5)

---

## Como Fazer o Deployment

### Pré-requisitos

- **Google Cloud SDK** (`gcloud`) instalado e autenticado
- Acesso ao projeto GCP (`project-dc8596f3-77e8-4941-a9a`)
- **Node.js/npm** instalado localmente (para compilar o frontend)
- Ficheiro `.env` configurado na raiz do projeto

### 1. Criar as VMs (apenas na primeira vez)

```bash
bash scripts/create_vms.sh
```

Este script cria 6 VMs na zona `europe-southwest1-c`:
- 2× Load Balancer (`lb-01`, `lb-02`)
- 2× WebApp (`web-1`, `web-2`)
- 2× Base de Dados (`db-01`, `db-02`)

> **Nota:** O número de VMs webapp é configurável com `NUM_WEBAPP_VMS=3 bash scripts/create_vms.sh`

### 2. Deploy completo

```bash
bash scripts/deploy.sh
```

Este é o **único comando necessário** para ir de VMs limpas a uma aplicação funcional. O script executa 4 fases:

#### Fase 0 — Build & Empacotamento
- Compila o frontend React (`npm run build`)
- Cria um tarball com `backend/`, `frontend/dist/`, `scripts/`, e `database/`
- O `venv/` local é excluído do tarball para não corromper o ambiente remoto

#### Fase 1 — Setup das Bases de Dados
Para cada VM de BD (`db-01`, `db-02`):
- Instala o PostgreSQL (se não estiver instalado)
- Aplica o `schema.sql` e `inserts.sql`
- Configura permissões de rede para a subnet `10.10.10.0/24`
- Atribui privilégios ao utilizador da aplicação (`tuxy_user`)

#### Fase 2 — Deploy das WebApps (Rolling Update)
Para cada VM webapp (`web-1`, `web-2`), sequencialmente:
- Envia o tarball via `gcloud compute scp`
- Instala dependências do sistema (Python, Nginx, etc.)
- Cria um `venv` Python e instala as dependências
- Configura o **Gunicorn** como serviço systemd
- Configura o **Nginx** para servir o frontend e fazer proxy do backend
- Executa as migrações Django (apenas na primeira VM)
- Executa um **health check** antes de avançar para a próxima VM

> O rolling update garante que pelo menos um servidor está sempre disponível durante o deployment.

#### Fase 3 — Setup dos Load Balancers
Para cada VM LB (`lb-01`, `lb-02`):
- Instala o Nginx
- Configura o upstream com os IPs das webapps
- Instala o cron job de healthcheck

### 3. Deploy rápido (apenas .env ou config)

Se só alteraste o `.env` e não o código:

```bash
# Enviar .env atualizado e reiniciar
gcloud compute scp .env web-1:/tmp/.env --project="project-dc8596f3-77e8-4941-a9a" --zone="europe-southwest1-c" --tunnel-through-iap
gcloud compute ssh web-1 --project="project-dc8596f3-77e8-4941-a9a" --zone="europe-southwest1-c" --tunnel-through-iap \
    --command="sudo cp /tmp/.env /home/athen/app/backend/.env && sudo systemctl restart gunicorn"
```

Repetir para `web-2`.

---

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
3. **Banning:** Qualquer utilizador pode ser banido por um Manager. Um utilizador banido falha a autenticação no endpoint `/auth/login/`.
4. **CORS:** Não é necessário `django-cors-headers`. Em desenvolvimento o Vite faz proxy, e em produção o Nginx trata do routing.
5. **Acesso SSH às VMs:** Todas as VMs usam IAP (Identity-Aware Proxy), não é necessário expor a porta 22:
   ```bash
   gcloud compute ssh <vm-name> --project="project-dc8596f3-77e8-4941-a9a" \
       --zone="europe-southwest1-c" --tunnel-through-iap
   ```

---

## Scripts de Infraestrutura

| Script | Onde corre | O que faz |
|:-------|:-----------|:----------|
| `create_vms.sh` | Local | Cria as 6 VMs no GCP com IPs estáticos |
| `deploy.sh` | Local | Orquestra todo o deployment (build → DB → webapp → LB) |
| `setup_db.sh` | VM de BD | Instala PostgreSQL, aplica schema, cria utilizador |
| `setup_webapp.sh` | VM webapp | Instala deps, configura Gunicorn+Nginx, corre migrações |
| `setup_lb.sh` | VM LB | Configura Nginx como load balancer com upstream dinâmico |
| `lb_healthcheck.sh` | VM LB (cron) | Verifica saúde das webapps e atualiza Nginx a cada minuto |
