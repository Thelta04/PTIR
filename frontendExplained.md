# PTIR System — Frontend Architecture & Backend Integration

This document serves as a deep dive into how the React frontend operates, maintains user sessions, and seamlessly bridges communication with the Django API backend.

## 1. Core Architecture

The frontend is a **Single Page Application (SPA)** built primarily with **React** and bundled using **Vite**.

- **Routing:** Handled completely client-side using `react-router-dom`. When a user navigates between the Manager, Driver, and Client dashboards, the page never fully reloads; instead, components mount and unmount dynamically.
- **Styling:** Vanilla CSS (`index.css`) mapping to a specialized design system based around the TUXY corporate branding identity (Ivory, Gold, and deep blacks for dark modes).
- **Icons & Animations:** Enhanced UI feedback uses `lucide-react` for scalable SVGs and `framer-motion` for fluid page transitions.

## 2. Authentication & Protected State

State management and security revolve heavily around standard JSON Web Tokens (JWT).

### `AuthContext.jsx`
All user sessions are encapsulated within a global React Context `AuthProvider`. 
- **Persistence:** Upon successful login at the `/api/auth/login/` endpoint, the Django backend sends an `access` and `refresh` token, alongside the user's `type` (role) and `name`. This information is safely serialized into `localStorage`. 
- Whenever the application reloads, `AuthContext` retrieves the values from `localStorage`, instantly bypassing the login UI if a user successfully previously authenticated.

### `ProtectedRoute.jsx`
This heavily utilizes `react-router-dom` to govern who can see what.
- It acts as a wrapper around the Dashboards. 
- If a user tries to access `/manager` but their context specifies `user_type: "driver"`, the `ProtectedRoute` intercepts the render and aggressively redirects them to `/login` (or ideally their respective dashboard).

## 3. Communication Layer (The Axios Client)

Rather than cluttering components with raw `fetch()` calls, all API interactions are centralized through an Axios wrapper defined at `src/api/client.js`.

**Why Axios?**
1. **Centralized Base URL:** It automatically prefixes all requests with `/api/` (e.g. `api.get('driver/')` expands properly without explicitly typing out `http://localhost:8000/api/driver/`).
2. **Global Headers:** Automatically enforces `Content-Type: application/json`.
3. **Easy Maintenance:** If the backend ever changes an endpoint parameter, we only edit one single file instead of hunting through dozens of React components.

## 4. How the Frontend Connects to the Backend

The frontend requires bypassing the browser's aggressive **CORS (Cross-Origin Resource Sharing)** policy. Since the frontend runs on a separate port than the backend, browsers automatically block API requests for security. However, since we own both ends, we bypass this smoothly utilizing two discrete strategies (Local vs Production):

### A. Local Development (Vite Proxy)
When developing locally using `npm run dev`, Vite spins up a server usually on `localhost:5173`. We configured `vite.config.js` to create an automatic proxy.
Whenever Axios fires off a request to `/api/driver/`, Vite intercepts it, pauses, routes it completely silently behind-the-scenes to `http://localhost:8000/api/driver/` (the Django local server), and returns the results. Your browser never realizes it talked to a different port!

### B. Production Deployment (Nginx Reverse Proxy)
When running the `docker-compose up` stack, the methodology shifts:
1. `nginx/Dockerfile` statically compiles the frontend artifacts (`npm run build`) and places them under `/usr/share/nginx/html`.
2. The `default.conf` configures Nginx to listen on Port 80.
3. Any user hitting `http://localhost/` receives the React files natively. 
4. However, Nginx sweeps any network request going to `/api/` or `/admin/` and specifically **routes** that traffic internally to the Python container (`proxy_pass http://backend;`). 

## 5. Live Data Display Flow

1. **Trigger:** A component mounts, or a user changes an active tab (like selecting "Taxis" dynamically on the Manager Dashboard).
2. **`useEffect` Hook:** This spots the change and invokes `listTaxis()` from the configured API client.
3. **Await:** React places a placeholder or spinner natively via state (`loading = true`).
4. **Resolution (`.then()`):** The backend serves JSON. React receives it, and writes the array of Taxi objects natively into its localized state (e.g., `setData(d => ({ ...d, taxis: res.data }))`).
5. **Render:** The DOM dynamically forces the `<table className="data-table">` to map down through the array, spilling the rows sequentially onto the screen.
6. **Toast Feedback:** A quick micro-interaction (e.g. `✅ Fetched 3 taxi records`) is pushed into the DOM using a simple `setTimeout()` to visually confirm data propagation to the user.
