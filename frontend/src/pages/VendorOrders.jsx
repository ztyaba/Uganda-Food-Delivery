import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi.js';
import { useRealtime } from '../contexts/RealtimeContext.jsx';

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export default function VendorOrders() {
  const api = useApi();
  const { socket } = useRealtime();
  const [orders, setOrders] = useState([]);
  const [updating, setUpdating] = useState(null);
  const [payoutInputs, setPayoutInputs] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const pushAlert = useCallback((message) => {
    if (!message) return;
    setAlerts((current) => {
      const next = [...current, { id: `${Date.now()}_${Math.random()}`, message }];
      return next.slice(-3);
    });
  }, []);

  const sortOrders = useCallback((list) => {
    return list.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, []);

  const loadOrders = useCallback(() => {
    api.get('/vendor/orders').then((response) => setOrders(sortOrders(response.data.orders)));
  }, [api, sortOrders]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    setPayoutInputs((current) => {
      const next = { ...current };
      orders.forEach((order) => {
        if (order.status !== 'received' && order.driverPayout != null) {
          next[order.id] = order.driverPayout;
        } else if (next[order.id] === undefined) {
          next[order.id] = order.driverPayout || order.driverShare || Math.round(order.total * 0.2);
        }
      });
      return next;
    });
  }, [orders]);

  const applyOrderUpdate = useCallback(
    (incoming) => {
      if (!incoming) return;
      setOrders((current) => sortOrders([incoming, ...current.filter((item) => item.id !== incoming.id)]));
    },
    [sortOrders]
  );

  useEffect(() => {
    if (!socket) return undefined;
    const handleUpdated = (payload) => {
      if (payload?.order) {
        applyOrderUpdate(payload.order);
      }
    };
    const handleNew = (payload) => {
      if (payload?.order) {
        applyOrderUpdate(payload.order);
        pushAlert(`New order #${payload.order.id} received`);
      }
    };
    const handleDriverAccepted = (payload) => {
      if (payload?.orderId) {
        pushAlert(`Driver accepted order #${payload.orderId}`);
      }
    };
    const handlePickedUp = (payload) => {
      if (payload?.orderId) {
        pushAlert(`Order #${payload.orderId} has been picked up`);
      }
    };
    const handleDelivered = (payload) => {
      if (payload?.orderId) {
        pushAlert(`Order #${payload.orderId} delivered. Pay driver within 5 minutes.`);
      }
    };
    const handlePayoutCompleted = (payload) => {
      if (payload?.orderId) {
        pushAlert(`Driver payout completed for order #${payload.orderId}`);
      }
    };
    const handlePayoutAuto = (payload) => {
      if (payload?.orderId) {
        pushAlert(`Auto-pay executed for order #${payload.orderId}`);
      }
    };

    socket.on('order:updated', handleUpdated);
    socket.on('order:new', handleNew);
    socket.on('order:driverAccepted', handleDriverAccepted);
    socket.on('order:pickedUp', handlePickedUp);
    socket.on('order:delivered', handleDelivered);
    socket.on('payout:completed', handlePayoutCompleted);
    socket.on('payout:auto', handlePayoutAuto);

    return () => {
      socket.off('order:updated', handleUpdated);
      socket.off('order:new', handleNew);
      socket.off('order:driverAccepted', handleDriverAccepted);
      socket.off('order:pickedUp', handlePickedUp);
      socket.off('order:delivered', handleDelivered);
      socket.off('payout:completed', handlePayoutCompleted);
      socket.off('payout:auto', handlePayoutAuto);
    };
  }, [socket, applyOrderUpdate, pushAlert]);

  const confirmOrder = async (orderId) => {
    const payoutValue = Number(payoutInputs[orderId]);
    if (!Number.isFinite(payoutValue) || payoutValue <= 0) {
      pushAlert('Enter a valid driver payout amount.');
      return;
    }
    setUpdating(orderId);
    try {
      await api.post(`/vendor/orders/${orderId}/confirm`, { driverPayout: payoutValue });
      loadOrders();
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to confirm order.';
      pushAlert(message);
    } finally {
      setUpdating(null);
    }
  };

  const payDriver = async (orderId) => {
    setUpdating(orderId);
    try {
      await api.post(`/vendor/orders/${orderId}/pay-driver`);
      loadOrders();
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to pay driver.';
      pushAlert(message);
    } finally {
      setUpdating(null);
    }
  };

  const payoutLabel = useCallback((order) => {
    if (order.driverPayout) {
      return `Driver payout: UGX ${Number(order.driverPayout).toLocaleString()}`;
    }
    return null;
  }, []);

  return (
    <section className="space-y-6">
      <h2 className="text-3xl font-black text-ink">Incoming orders</h2>
      {alerts.length > 0 && (
        <div className="glass-panel rounded-3xl p-4">
          <ul className="space-y-2 text-sm text-slate-600">
            {alerts.map((alert) => (
              <li key={alert.id}>{alert.message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-4">
        {orders.map((order) => {
          const payoutInfo = payoutLabel(order);
          let dueSeconds = null;
          if (order.payoutDueAt && !order.isPaid) {
            const due = Date.parse(order.payoutDueAt);
            if (!Number.isNaN(due)) {
              dueSeconds = Math.max(0, Math.floor((due - now) / 1000));
            }
          }

          return (
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
              <div className="mt-4 space-y-3">
                {order.status === 'received' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-ink shadow-inner"
                      value={payoutInputs[order.id] ?? ''}
                      onChange={(event) =>
                        setPayoutInputs((current) => ({ ...current, [order.id]: event.target.value }))
                      }
                    />
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => confirmOrder(order.id)}
                      disabled={updating === order.id}
                      className={`rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow ${
                        updating === order.id ? 'opacity-60' : ''
                      }`}
                    >
                      Confirm Order
                    </motion.button>
                  </div>
                )}
                {order.status !== 'received' && payoutInfo && (
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{payoutInfo}</p>
                )}
                {order.status === 'delivered' && !order.isPaid && (
                  <div className="flex flex-wrap items-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => payDriver(order.id)}
                      disabled={updating === order.id}
                      className={`rounded-2xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-glow ${
                        updating === order.id ? 'opacity-60' : ''
                      }`}
                    >
                      Pay Driver
                    </motion.button>
                    {dueSeconds != null && (
                      <span className="text-xs font-semibold text-brand-600">
                        Auto-pay in {formatCountdown(dueSeconds)}
                      </span>
                    )}
                  </div>
                )}
                {order.status === 'delivered' && order.isPaid && (
                  <p className="text-xs font-semibold text-emerald-500">
                    Driver paid {order.paidAt ? new Date(order.paidAt).toLocaleTimeString() : ''}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
