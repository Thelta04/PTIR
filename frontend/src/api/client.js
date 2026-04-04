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
export const getDriver = (id) => api.get(`driver/${id}`);
export const listDrivers = () => api.get('drivers/');

// ── Taxis ───────────────────────────────────────
export const getTaxi = (plate) => api.get(`taxi/${plate}`);
export const listTaxis = () => api.get('taxis/');

// ── Shifts ──────────────────────────────────────
export const listShifts = (driverId) => api.get(`shift/get/${driverId}/`);
export const listAllShifts = () => api.get('shifts/');
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
