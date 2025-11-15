import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi.js';
import JobCard from '../components/JobCard.jsx';
import { useRealtime } from '../contexts/RealtimeContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function DriverJobs() {
  const api = useApi();
  const { ready, subscribe } = useRealtime();
  const { socket } = useRealtime();
  const { user } = useAuth();
  const userId = user?.id;
  const [available, setAvailable] = useState([]);
  const [active, setActive] = useState([]);
  const [actionOrderId, setActionOrderId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const sortOrders = useCallback((list) => {
    return list.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, []);

  const load = useCallback(() => {
    api.get('/driver/available').then((response) => setAvailable(sortOrders(response.data.orders)));
    api.get('/driver/orders').then((response) => {
      const current = response.data.orders.filter((order) => order.status !== 'delivered');
      setActive(sortOrders(current));
    });
  }, [api, sortOrders]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const applyOrderUpdate = useCallback(
    (order) => {
      if (!order) return;
      setAvailable((current) => {
        const others = current.filter((item) => item.id !== order.id);
        if (order.status === 'preparing' && !order.assignedDriver) {
          return sortOrders([order, ...others]);
        }
        return others;
      });
      setActive((current) => {
        const others = current.filter((item) => item.id !== order.id);
        if (order.assignedDriver === userId && order.status !== 'delivered') {
          return sortOrders([order, ...others]);
        }
        return others;
      });
    },
    [sortOrders, userId]
  );

  useEffect(() => {
    if (!ready) return undefined;
    if (!socket) return undefined;
    const handleAvailable = (payload) => {
      if (payload?.order) {
        applyOrderUpdate(payload.order);
      }
    };
    const handleUpdated = (payload) => {
      if (payload?.order) {
        applyOrderUpdate(payload.order);
      }
    };
    const handleTaken = (payload) => {
      if (!payload?.orderId) return;
      setAvailable((current) => current.filter((order) => order.id !== payload.orderId));
      if (payload.driverId !== userId) {
        setFeedback('Order already taken.');
      }
    };

    const offAvailable = subscribe('order:available', handleAvailable);
    const offUpdated = subscribe('order:updated', handleUpdated);
    const offTaken = subscribe('order:taken', handleTaken);

    return () => {
      offAvailable();
      offUpdated();
      offTaken();
    };
  }, [ready, subscribe, applyOrderUpdate, userId]);
    socket.on('order:available', handleAvailable);
    socket.on('order:updated', handleUpdated);
    socket.on('order:taken', handleTaken);

    return () => {
      socket.off('order:available', handleAvailable);
      socket.off('order:updated', handleUpdated);
      socket.off('order:taken', handleTaken);
    };
  }, [socket, applyOrderUpdate, userId]);

  const accept = async (orderId) => {
    setActionOrderId(orderId);
    try {
      await api.post(`/driver/orders/${orderId}/accept`);
      load();
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to accept delivery.';
      setFeedback(message);
    } finally {
      setActionOrderId(null);
    }
  };

  const markPickedUp = async (orderId) => {
    setActionOrderId(orderId);
    try {
      await api.post(`/driver/orders/${orderId}/picked-up`);
      load();
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to mark pickup.';
      setFeedback(message);
    } finally {
      setActionOrderId(null);
    }
  };

  const markDelivered = async (orderId) => {
    setActionOrderId(orderId);
    try {
      await api.post(`/driver/orders/${orderId}/delivered`);
      load();
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to complete delivery.';
      setFeedback(message);
    } finally {
      setActionOrderId(null);
    }
  };

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-ink">Available jobs</h2>
        <p className="text-sm text-slate-500">Swipe through opportunities and accept with fluid animations.</p>
      </div>
      {feedback && (
        <div className="glass-panel rounded-3xl p-4 text-sm text-brand-600">{feedback}</div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {available.map((order) => (
          <JobCard
            key={order.id}
            order={order}
            variant="available"
            onAccept={() => accept(order.id)}
            disabled={actionOrderId === order.id}
          />
        ))}
      </div>
      <div>
        <h3 className="text-2xl font-semibold text-ink">Active deliveries</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {active.map((order) => (
            <motion.div key={order.id} layout>
              <JobCard
                order={order}
                variant="active"
                onPickedUp={() => markPickedUp(order.id)}
                onDelivered={() => markDelivered(order.id)}
                disabled={actionOrderId === order.id}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
