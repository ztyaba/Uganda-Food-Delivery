import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi.js';
import OrderTimeline from '../components/OrderTimeline.jsx';
import LiveMap from '../components/LiveMap.jsx';
import { useRealtime } from '../contexts/RealtimeContext.jsx';

export default function CustomerTracking() {
  const { id } = useParams();
  const api = useApi();
  const { ready, subscribe } = useRealtime();
  const [order, setOrder] = useState(null);

  const loadOrder = useCallback(() => {
    api.get(`/customer/orders/${id}`).then((response) => setOrder(response.data.order));
  }, [api, id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!ready) return undefined;
    const offUpdated = subscribe('order:updated', (payload) => {
      if (payload?.order?.id === id) {
        setOrder(payload.order);
      }
    });
    const offProgress = subscribe('order:progress', (payload) => {
      if (payload?.orderId === id) {
        loadOrder();
      }
    });
    return () => {
      offUpdated();
      offProgress();
    };
  }, [ready, subscribe, id, loadOrder]);

  if (!order) {
    return <div className="h-32 animate-pulse rounded-3xl bg-white/70" />;
  }

  const headline = order.items.length > 0
    ? `${order.items[0].name}${order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}`
    : 'Delicious order in progress';

  return (
    <section className="grid gap-8 lg:grid-cols-[0.8fr,1.2fr]">
      <div className="space-y-6">
        <div className="glass-panel rounded-3xl p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Order #{order.id}</p>
          <p className="mt-2 text-2xl font-black text-ink">{headline}</p>
          <p className="mt-1 text-sm text-slate-500">Current status: {order.status}</p>
        </div>
        <OrderTimeline currentStatus={order.status} />
      </div>
      <div className="space-y-6">
        <LiveMap status={order.status} />
        <motion.div className="glass-panel rounded-3xl p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="text-lg font-semibold text-ink">Driver details</h3>
          {order.driverId ? (
            <div className="mt-4 flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-xl">🛵</span>
              <div>
                <p className="text-sm font-semibold text-ink">Driver assigned</p>
                <p className="text-xs text-slate-500">They&apos;ll call when arriving</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">A driver will be assigned shortly.</p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
