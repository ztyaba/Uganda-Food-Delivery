import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi.js';
import JobCard from '../components/JobCard.jsx';

export default function DriverJobs() {
  const api = useApi();
  const [available, setAvailable] = useState([]);
  const [active, setActive] = useState([]);

  const load = useCallback(() => {
    api.get('/driver/available').then((response) => setAvailable(response.data.orders));
    api.get('/driver/orders').then((response) => setActive(response.data.orders));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async (orderId) => {
    await api.post(`/driver/orders/${orderId}/accept`);
    load();
  };

  const markDelivered = async (orderId) => {
    await api.patch(`/driver/orders/${orderId}/status`, { status: 'delivered' });
    load();
  };

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-ink">Available jobs</h2>
        <p className="text-sm text-slate-500">Swipe through opportunities and accept with fluid animations.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {available.map((order) => (
          <JobCard key={order.id} order={order} onAccept={() => accept(order.id)} variant="available" />
        ))}
      </div>
      <div>
        <h3 className="text-2xl font-semibold text-ink">Active deliveries</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {active.map((order) => (
            <motion.div key={order.id} layout>
              <JobCard order={order} variant="active" onComplete={() => markDelivered(order.id)} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
