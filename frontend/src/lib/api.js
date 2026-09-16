export const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // sin body
  }

  if (!res.ok) {
    const message = data?.error || `Error ${res.status}`;
    throw new Error(message);
  }

  return data;
}

// ---------- Público ----------

export const getBusiness = () => request('/business');
export const getServices = () => request('/services');
export const getProfessionals = (serviceId) => request(`/professionals${serviceId ? `?serviceId=${serviceId}` : ''}`);
export const getAvailability = (serviceId, professionalId, date) =>
  request(`/availability?serviceId=${serviceId}&professionalId=${professionalId || 'any'}&date=${date}`);

export const createBooking = (payload) =>
  request('/bookings', { method: 'POST', body: JSON.stringify(payload) });

export const getBooking = (id, token) => request(`/bookings/${id}?token=${token}`);

export const payDeposit = (id, token, cardNumber) =>
  request(`/bookings/${id}/pay`, { method: 'POST', body: JSON.stringify({ token, cardNumber }) });

export const cancelBooking = (id, token) =>
  request(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ token }) });

// ---------- Admin ----------

const TOKEN_KEY = 'bruma_admin_token';

export function getAdminToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export const adminLogin = (email, password) =>
  request('/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) });

async function adminRequest(path, options = {}) {
  const token = getAdminToken();
  try {
    return await request(path, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
  } catch (err) {
    if (err.message === 'No autenticado' || err.message === 'Token inválido o expirado') {
      clearAdminToken();
      window.location.href = '/admin';
    }
    throw err;
  }
}

export const getAdminBookings = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return adminRequest(`/admin/bookings${qs ? `?${qs}` : ''}`);
};
export const updateBookingStatus = (id, status) =>
  adminRequest(`/admin/bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });

export const getAdminServices = () => adminRequest('/admin/services');
export const createService = (payload) => adminRequest('/admin/services', { method: 'POST', body: JSON.stringify(payload) });
export const updateService = (id, payload) => adminRequest(`/admin/services/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const getAdminProfessionals = () => adminRequest('/admin/professionals');
export const createProfessional = (payload) => adminRequest('/admin/professionals', { method: 'POST', body: JSON.stringify(payload) });
export const updateProfessional = (id, payload) => adminRequest(`/admin/professionals/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

export const getAdminStats = (date) => adminRequest(`/admin/stats${date ? `?date=${date}` : ''}`);
