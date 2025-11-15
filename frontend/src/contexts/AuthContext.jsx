import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/config.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ufd_token'));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('ufd_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem('ufd_token', token);
    } else {
      localStorage.removeItem('ufd_token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('ufd_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ufd_user');
    }
  }, [user]);

  const client = useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE_URL });
    const instance = axios.create({ baseURL: API_BASE });
    instance.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    return instance;
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
      const response = await axios.post(`${API_BASE}/auth/login`, { email, password });
      setToken(response.data.token);
      setUser(response.data.user);
      return response.data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    if (!token) return null;
    const response = await client.get('/auth/profile');
    setUser(response.data);
    return response.data;
  };

  const value = {
    token,
    user,
    loading,
    client,
    login,
    logout,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
