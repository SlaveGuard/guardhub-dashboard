import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { logger } from '../lib/logger';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

if (!configuredApiUrl) {
  throw new Error('Missing VITE_API_URL. Set it in the dashboard .env file.');
}

export const API_URL = configuredApiUrl;

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string | null> | null = null;

function isAuthRequest(url: string) {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh')
  );
}

async function refreshAccessToken() {
  const { refreshToken, setTokens, logout } = useAuthStore.getState();
  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    logger.info('ApiClient', 'Token refresh triggered');
    refreshPromise = apiClient
      .post('/auth/refresh', { refreshToken })
      .then((response) => {
        const nextAccessToken = response.data.accessToken as string | undefined;
        const nextRefreshToken = response.data.refreshToken as string | undefined;
        if (!nextAccessToken || !nextRefreshToken) {
          throw new Error('Refresh response is missing tokens');
        }

        setTokens(nextAccessToken, nextRefreshToken);
        return nextAccessToken;
      })
      .catch((error) => {
        logger.error('ApiClient', 'Token refresh failed, user will be logged out', {
          message: error?.response?.data?.message ?? error.message,
        });
        logout();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  logger.debug('ApiClient', 'API request sent', {
    method: config.method?.toUpperCase(),
    url: config.url,
  });
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    logger.info('ApiClient', 'API response received', {
      status: response.status,
      url: response.config.url,
    });
    return response;
  },
  async (error: AxiosError) => {
    const requestUrl = String(error.config?.url || '');
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const { token, refreshToken, logout } = useAuthStore.getState();
    const status = error.response?.status;
    const message =
      (error.response?.data as { message?: string } | undefined)?.message ?? error.message;

    if (status && status >= 500) {
      logger.error('ApiClient', 'API response 5xx', { status, url: requestUrl, message });
    } else if (status && status >= 400) {
      logger.warning('ApiClient', 'API response 4xx', { status, url: requestUrl, message });
    }

    if (
      error.response?.status === 401 &&
      token &&
      refreshToken &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRequest(requestUrl)
    ) {
      originalRequest._retry = true;

      try {
        const nextAccessToken = await refreshAccessToken();
        if (nextAccessToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        logger.error('ApiClient', 'Token refresh failed, user will be logged out', {
          message:
            (refreshError as any)?.response?.data?.message ?? (refreshError as Error).message,
        });
        logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401 && token && !isAuthRequest(requestUrl)) {
      logout();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  },
);
