import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi.js';
import WalletSummary from '../components/WalletSummary.jsx';
import JobCard from '../components/JobCard.jsx';
import { useRealtime } from '../contexts/RealtimeContext.jsx';

export default function DriverDashboard() {
  const api = useApi();
  const [data, setData] = useState(null);
  const { ready, subscribe } = useRealtime();

  const loadDashboard = useCallback(() => {
    api.get('/driver/dashboard').then((response) => setData(response.data));
  }, [api]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!ready) return undefined;
    const refresh = () => loadDashboard();
    const offAvailable = subscribe('order:available', refresh);
    const offUpdated = subscribe('order:updated', refresh);
    const offTaken = subscribe('order:taken', refresh);
    const offPaid = subscribe('payout:completed', refresh);
    const offAuto = subscribe('payout:auto', refresh);
    return () => {
      offAvailable();
      offUpdated();
      offTaken();
      offPaid();
      offAuto();
    };
  }, [ready, subscribe, loadDashboard]);

  if (!data) {
    return <div className="h-32 animate-pulse rounded-3xl bg-white/70" />;
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-black text-ink">Deliveries at a glance</h2>
          <p className="text-sm text-slate-500">Glide between available pickups and active routes.</p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-600"
        >
          {data.summary.availableJobs} jobs nearby
        </motion.div>
      </div>
      <WalletSummary wallet={data.summary.wallet} title="Driver wallet" />
      <div className="grid gap-4 md:grid-cols-2">
        {data.available.slice(0, 2).map((order) => (
          <JobCard key={order.id} order={order} variant="available" disabled />
        ))}
      </div>
    </section>
  );
}
