const DEFAULT_LOCAL_BASE = 'http://localhost:4000/api';

function sanitize(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/, '');
}

function appendApiSegment(base) {
  if (!base) {
    return DEFAULT_LOCAL_BASE;
  }
  if (base.endsWith('/api')) {
    return base;
  }
  return `${base}/api`;
}

export function resolveApiBaseUrl() {
  const envBase = sanitize(import.meta.env.VITE_API_BASE_URL);
  if (envBase) {
    return appendApiSegment(envBase);
  }

  if (typeof window !== 'undefined') {
    const runtimeBase = sanitize(window.__APP_API_BASE_URL);
    if (runtimeBase) {
      return appendApiSegment(runtimeBase);
    }

    if (window.location && window.location.hostname !== 'localhost') {
      const origin = sanitize(window.location.origin);
      if (origin) {
        return appendApiSegment(origin);
      }
    }
  }

  return DEFAULT_LOCAL_BASE;
}

const RESOLVED_API_BASE = resolveApiBaseUrl();

export const API_BASE_URL = RESOLVED_API_BASE;
export const SOCKET_BASE_URL = RESOLVED_API_BASE.replace(/\/?api$/, '');
