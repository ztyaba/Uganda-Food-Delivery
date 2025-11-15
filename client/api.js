const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body != null) {
    headers['Content-Type'] = JSON_HEADERS['Content-Type'];
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = { message: text };
    }
  }
  if (!response.ok) {
    const message = data?.message || response.statusText || 'Request failed';
const STORAGE_KEY = 'uganda_food_delivery_token';

export function getToken() {
  return localStorage.getItem(STORAGE_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(STORAGE_KEY, token);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    ...options
  });
  if (response.status === 204) {
    return null;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || 'Unexpected error';
    throw new Error(message);
  }
  return data;
}

export async function fetchPublicCatalog() {
  return request('/api/public/restaurants');
}

export async function createCustomerOrder(payload) {
  return request('/api/public/orders', { method: 'POST', body: payload });
}

export async function trackOrder(trackingCode) {
  return request(`/api/public/orders/${encodeURIComponent(trackingCode)}`);
}

export async function login(email, password) {
  return request('/api/auth/login', { method: 'POST', body: { email, password } });
}

export async function fetchProfile(token) {
  return request('/api/profile', { token });
}

export async function fetchOrders(token) {
  return request('/api/orders', { token });
}

export async function updateStatus(token, orderId, payload) {
  return request(`/api/orders/${orderId}/status`, { method: 'POST', body: payload, token });
}

export async function assignDriver(token, orderId, driverId) {
  return request(`/api/orders/${orderId}/assign-driver`, {
    method: 'POST',
    body: { driverId },
    token
  });
}

export async function driverAccept(token, orderId) {
  return request(`/api/orders/${orderId}/accept`, { method: 'POST', token });
}

export async function recordPayment(token, orderId, payload) {
  return request(`/api/orders/${orderId}/payments`, { method: 'POST', body: payload, token });
}

export async function withdraw(token, payload) {
  return request('/api/wallets/withdraw', { method: 'POST', body: payload, token });
}

export function openStream(token) {
  return new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);
}

export function login(credentials) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
}

export function fetchOrders() {
  return request('/api/orders');
}

export function fetchOrder(id) {
  return request(`/api/orders/${id}`);
}

export function fetchMetrics() {
  return request('/api/metrics');
}

export function createOrder(payload) {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function assignDriver(id, payload) {
  return request(`/api/orders/${id}/assign-driver`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateStatus(id, payload) {
  return request(`/api/orders/${id}/status`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function recordPayment(id, payload) {
  return request(`/api/orders/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function openEventStream(onMessage) {
  const token = getToken();
  if (!token) return null;
  const source = new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);
  source.onmessage = (event) => {
    if (event.data) {
      try {
        onMessage({ type: event.type || 'message', data: JSON.parse(event.data) });
      } catch (err) {
        onMessage({ type: event.type || 'message', data: event.data });
      }
    }
  };
  source.addEventListener('order_created', (event) => {
    try {
      onMessage({ type: 'order_created', data: JSON.parse(event.data) });
    } catch (err) {
      onMessage({ type: 'order_created', data: event.data });
    }
  });
  source.addEventListener('order_updated', (event) => {
    try {
      onMessage({ type: 'order_updated', data: JSON.parse(event.data) });
    } catch (err) {
      onMessage({ type: 'order_updated', data: event.data });
    }
  });
  source.addEventListener('payment_recorded', (event) => {
    try {
      onMessage({ type: 'payment_recorded', data: JSON.parse(event.data) });
    } catch (err) {
      onMessage({ type: 'payment_recorded', data: event.data });
    }
  });
  return source;
}
