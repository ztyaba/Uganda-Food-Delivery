import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi.js';

const statuses = ['received', 'preparing', 'ready for pickup', 'on the way', 'delivered'];

export default function VendorOrders() {
  const api = useApi();
  const [orders, setOrders] = useState([]);
  const [updating, setUpdating] = useState(null);

  const loadOrders = useCallback(() => {
    api.get('/vendor/orders').then((response) => setOrders(response.data.orders));
  }, [api]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const updateStatus = async (orderId, status) => {
    setUpdating(orderId);
    await api.patch(`/vendor/orders/${orderId}/status`, { status });
    loadOrders();
    setUpdating(null);
  };

  return (
    <section className="space-y-6">
      <h2 className="text-3xl font-black text-ink">Incoming orders</h2>
      <div className="space-y-4">
        {orders.map((order) => (
          <motion.div key={order.id} layout className="glass-panel rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Order #{order.id}</p>
                <p className="text-lg font-bold text-ink">UGX {order.total.toLocaleString()}</p>
                <p className="text-xs text-slate-500">Restaurant: {order.restaurantName || 'N/A'}</p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
                {order.status}
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              {order.items.map((item) => (
                <div key={item.menuItemId} className="flex items-center justify-between">
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  <span>UGX {item.subtotal.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => updateStatus(order.id, status)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    order.status === status
                      ? 'bg-brand-500 text-white shadow-glow'
                      : 'bg-white/80 text-slate-500 shadow-card'
                  } ${updating === order.id ? 'opacity-60' : ''}`}
                  disabled={updating === order.id}
                >
                  {status}
                </button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
