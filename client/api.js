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
