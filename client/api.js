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

