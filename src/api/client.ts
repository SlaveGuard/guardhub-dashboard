import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Default to local NestJS backend for MVP
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject Bearer token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const token = useAuthStore.getState().token;
    const requestUrl = String(error.config?.url || '');
    const isAuthRequest =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh');

    if (error.response?.status === 401 && token && !isAuthRequest) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
