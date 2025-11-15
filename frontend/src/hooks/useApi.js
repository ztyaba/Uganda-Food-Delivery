import { useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext.jsx';
import { API_BASE_URL } from '../utils/config.js';

export function useApi() {
  const { token } = useAuth();

  return useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE_URL });
    instance.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    return instance;
  }, [token]);
}
