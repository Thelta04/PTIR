# PTIR - Taxi Fleet Management System

Welcome to the PTIR Taxi Management application. This document serves as a quick reference for developers working on the project, especially for things that are easy to forget.

## Project Structure

- **`backend/`**: Django REST Framework API. Contains the `core` configuration and the `api` app.
- **`database/`**: PostgreSQL database scripts (`schema.sql`, `inserts.sql`) and setup bash scripts.
- **`frontend/`**: Vite + React frontend application.

## Database Management (PostgreSQL)

The application uses PostgreSQL. The database name is `tuxy_db` and it's accessed via the `tuxy_user`.

### Resetting / Populating the Database
If you need to wipe the database clean and start over with the default mock data, use the provided script from the `database/` folder:

```bash
cd database
sudo bash start_db.sh
```

## Running via Docker

The entire application can be run using Docker Compose, orchestrating the PostgreSQL database, Django backend (Gunicorn), and an Nginx reverse proxy serving the compiled React frontend.

1. Get the `.env` file (Available at Discord)
2. Build and start all services:
   ```bash
   docker compose up --build
   ```

- **Frontend:** Accessible at `http://localhost:80`
- **Backend API:** Proxied through Nginx at `http://localhost:80/api/`

## Running the Backend (Without Docker)

Ensure your virtual environment is active, then start the Django development server:

```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

## API Documentation (Swagger)

The project uses `drf-spectacular` to automatically generate OpenAPI documentation based on the API views and serializers.

When the backend server is running (`localhost:8000`), you can access the docs at:
- **Swagger UI:** [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)
- **Raw Schema:** [http://localhost:8000/api/schema/](http://localhost:8000/api/schema/)

## Default Test Accounts

After running `./start_db.sh`, the following accounts are available for testing (password is `password` specified, e.g. `Joao123`):

| ID | Role | Name | Email | Password |
| :--- | :--- | :--- | :--- | :--- |
|1| **Driver** | Joao Silva | `joao@email.com` | `Joao123` |
|2| **Driver** | Pedro Santos | `pedro@email.com` | `Pedro123` |
|3| **Client** | Maria Costa | `maria@email.com` | `Maria123` |
|4| **Client** | Ana Ferreira | `ana@email.com` | `Ana123` |
|5| **Manager** | Carlos Mendes | `carlos@email.com` | `Carlos123` |

## JWT Authentication (Manager Endpoints)

Manager-only endpoints are protected with JWT. Clients and Drivers do **not** use tokens.

### Flow

1. **Login** — `POST /api/auth/login/` with `email` + `password`. Managers receive `access` and `refresh` tokens in the response.
2. **Use the token** — include `Authorization: Bearer <access_token>` in requests to protected endpoints.
3. **Refresh** — when the access token expires (30 min), call `POST /api/auth/token/refresh/` with the `refresh` token to get a new access token. Refresh tokens last 7 days.

### Protected Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/taxi/register/` | Register a new taxi |
| POST | `/api/shift/create/` | Create a new shift |
| DELETE | `/api/shift/<id>/delete/` | Delete a shift |
| PATCH | `/api/user/<id>/toggle-status/` | Ban / unban a user |

### Example (cURL)

```bash
# 1. Login as manager
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "carlos@email.com", "password": "Carlos123"}'
# Response includes: "access": "<token>", "refresh": "<token>"

# 2. Use access token on a protected endpoint
curl -X POST http://localhost:8000/api/taxi/register/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"license_plate": "XX-99-YY", ...}'

# 3. Refresh an expired access token
curl -X POST http://localhost:8000/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh_token>"}'
```

## Important Reminders

1. **Banning:** Any user can be banned by a Manager (JWT required). A banned user (`is_banned=True`) will fail authentication at the `/auth/login/` endpoint.
2. **Dates and Times:** Ensure `timezone.now()` is used rather than standard Python `datetime` for tz-aware operations where needed.
