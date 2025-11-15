import { useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export function useApi() {
  const { token } = useAuth();

  return useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE });
    instance.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    return instance;
  }, [token]);
}
