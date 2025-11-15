import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi.js';
import MetricsPanel from '../components/MetricsPanel.jsx';
import { useRealtime } from '../contexts/RealtimeContext.jsx';

export default function VendorDashboard() {
  const api = useApi();
  const [data, setData] = useState(null);
  const { ready, subscribe } = useRealtime();
  const { socket } = useRealtime();

  const loadDashboard = useCallback(() => {
    api.get('/vendor/dashboard').then((response) => setData(response.data));
  }, [api]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!ready) return undefined;
    const refresh = () => loadDashboard();
    const offUpdated = subscribe('order:updated', refresh);
    const offNew = subscribe('order:new', refresh);
    const offAccepted = subscribe('order:driverAccepted', refresh);
    const offPicked = subscribe('order:pickedUp', refresh);
    const offDelivered = subscribe('order:delivered', refresh);
    const offPaid = subscribe('payout:completed', refresh);
    const offAuto = subscribe('payout:auto', refresh);
    return () => {
      offUpdated();
      offNew();
      offAccepted();
      offPicked();
      offDelivered();
      offPaid();
      offAuto();
    };
  }, [ready, subscribe, loadDashboard]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => loadDashboard();
    socket.on('order:updated', refresh);
    socket.on('order:new', refresh);
    socket.on('order:driverAccepted', refresh);
    socket.on('order:pickedUp', refresh);
    socket.on('order:delivered', refresh);
    socket.on('payout:completed', refresh);
    socket.on('payout:auto', refresh);
    return () => {
      socket.off('order:updated', refresh);
      socket.off('order:new', refresh);
      socket.off('order:driverAccepted', refresh);
      socket.off('order:pickedUp', refresh);
      socket.off('order:delivered', refresh);
      socket.off('payout:completed', refresh);
      socket.off('payout:auto', refresh);
    };
  }, [socket, loadDashboard]);

  if (!data) {
    return <div className="h-32 animate-pulse rounded-3xl bg-white/70" />;
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-black text-ink">Kitchen control centre</h2>
          <p className="text-sm text-slate-500">Track incoming orders and monitor wallet balances in real-time.</p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-600"
        >
          {data.restaurants.length} restaurants live
        </motion.div>
      </div>
      <MetricsPanel metrics={data.metrics} />
      <div className="glass-panel rounded-3xl p-6">
        <h3 className="text-lg font-semibold text-ink">Live orders</h3>
        <div className="mt-4 space-y-4">
          {data.metrics.pendingOrders === 0 && <p className="text-sm text-slate-500">No pending orders 🎉</p>}
          {data.restaurants.map((restaurant) => (
            <div key={restaurant.id} className="rounded-3xl bg-white/80 p-4 shadow-card">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold text-ink">{restaurant.name}</h4>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
                  {restaurant.menu.length} menu items
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{restaurant.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
