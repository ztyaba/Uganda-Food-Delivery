const Api = {
  async listRestaurants() {
    const response = await fetch('/api/restaurants');
    if (!response.ok) {
      throw new Error('Failed to load restaurants');
    }
    return response.json();
  },

  async createOrder(payload) {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to submit order');
    }
    return response.json();
  },

  async fetchOrder(id) {
    const response = await fetch(`/api/orders/${id}`);
    if (!response.ok) {
      throw new Error('Order not found');
    }
    return response.json();
  }
};

window.Api = Api;
