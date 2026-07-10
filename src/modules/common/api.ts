import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.token) {
      localStorage.setItem('token', res.data.token);
    }
    return res.data;
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('token');
  },

  getToken: () => localStorage.getItem('token'),
  isAuthenticated: () => !!localStorage.getItem('token'),
};

export const ordersService = {
  getAll: async (status?: string) => {
    const params = status ? `?status=${status}` : '';
    const res = await api.get(`/orders${params}`);
    return res.data;
  },

  updateStatus: async (id: string, status: string, preparationDuration?: number, deliveryFee?: number) => {
    const res = await api.put(`/orders/${id}`, { status, preparationDuration, deliveryFee });
    return res.data;
  },

  create: async (data: Record<string, unknown>) => {
    const res = await api.post('/orders', data);
    return res.data;
  },
};

export const productsService = {
  getAll: async () => {
    const res = await api.get('/products');
    return res.data;
  },
};

export const statisticsService = {
  getReports: async (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const query = params.toString() ? `?${params}` : '';
    const res = await api.get(`/reports${query}`);
    return res.data;
  },
};

// Sends the FCM device token to the backend so it can push notifications to this device.
// Backend endpoint: POST /notifications/register-token  { token: string, platform?: string, phone?: string }
export const notificationsService = {
  registerToken: async (token: string, phone?: string) => {
    await api.post('/notifications/register-token', { token, phone });
  },
};

export default api;
