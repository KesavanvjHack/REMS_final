import axios from 'axios';

// Base URL for Django Backend (uses env var in production, localhost in dev)
let BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Foolproof fix: Automatically ensure /api is at the end of the URL
if (BASE_URL && !BASE_URL.endsWith('/api') && !BASE_URL.endsWith('/api/')) {
  BASE_URL = BASE_URL.replace(/\/+$/, '') + '/api';
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Access Token and Fix URLs
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Fix absolute path stripping baseURL issue in Axios
    if (config.url && config.url.startsWith('/')) {
      config.url = config.url.substring(1);
    }

    // Ensure baseURL ends with a slash
    if (config.baseURL && !config.baseURL.endsWith('/')) {
      config.baseURL += '/';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401s and Refresh Token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });

          const newAccessToken = res.data.access;
          localStorage.setItem('access_token', newAccessToken);

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh token expired or invalid
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }

    // Global error notification for server errors
    if (error.response?.status >= 500) {
      const { toast } = await import('react-hot-toast');
      toast.error('Server error. Please try again later.');
    } else if (error.code === 'ECONNABORTED' || !error.response) {
      const { toast } = await import('react-hot-toast');
      toast.error('Network error. Check your connection.');
    }

    return Promise.reject(error);
  }
);

export default api;
