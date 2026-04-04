import axios from 'axios';

const api = axios.create({
  baseURL: '/api/',
  headers: { 'Content-Type': 'application/json' },
});

// ── Auth ────────────────────────────────────────
export const login = (email, password) =>
  api.post('auth/login/', { email, password });

export const refreshToken = (refresh) =>
  api.post('auth/token/refresh/', { refresh });

// ── Users ───────────────────────────────────────
export const getClient = (id) => api.get(`client/${id}`);
export const listClients = () => api.get('client/');
export const createClient = (data) => api.post('auth/create/client/', data);
export const getDriver = (id) => api.get(`driver/${id}`);
export const listDrivers = () => api.get('driver/');
export const createDriver = (data) => api.post('auth/create/driver/', data);

// ── Taxis ───────────────────────────────────────
export const getTaxi = (plate) => api.get(`taxi/${plate}`);
export const listTaxis = () => api.get('taxi/');
export const createTaxi = (data) => api.post('taxi/create/', data);

// ── Shifts ──────────────────────────────────────
export const listShifts = (driverId) => api.get(`shift/get/${driverId}/`);
export const listAllShifts = () => api.get('shift/');
export const createShift = (data) => api.post('shift/create/', data);
export const startShift = (id) => api.patch(`shift/${id}/start`);
export const endShift = (id) => api.patch(`shift/${id}/end`);

// ── Trips ───────────────────────────────────────
export const listTrips = (status) => {
  const params = status ? { status } : {};
  return api.get('trip/', { params });
};

export const createTrip = (data) => api.post('trip/create/', data);
export const acceptTrip = (id, driverId) =>
  api.patch(`trip/${id}/accept/`, { driver_id: driverId });
export const cancelTrip = (id) => api.patch(`trip/${id}/cancel/`);

export default api;
