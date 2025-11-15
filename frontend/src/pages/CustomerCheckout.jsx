import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCart } from '../contexts/CartContext.jsx';
import { useApi } from '../hooks/useApi.js';

export default function CustomerCheckout() {
  const { items, totals, restaurant, clear } = useCart();
  const navigate = useNavigate();
  const api = useApi();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (items.length === 0 || !restaurant) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        restaurantId: restaurant.id,
        items: items.map(({ menuItemId, quantity }) => ({ menuItemId, quantity })),
        deliveryAddress: 'Kololo, Kampala',
        paymentMethod: 'mobile money',
        note
      };
      const response = await api.post('/customer/orders', payload);
      clear();
      navigate(`/customer/orders/${response.data.order.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!restaurant) {
    return (
      <section className="space-y-4">
        <h2 className="text-3xl font-black text-ink">Checkout</h2>
        <p className="text-sm text-slate-500">Your cart is empty. Add dishes from a restaurant to begin.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
      <div className="space-y-4">
        <h2 className="text-3xl font-black text-ink">Checkout</h2>
        <div className="glass-panel rounded-3xl p-6">
          <h3 className="text-lg font-semibold text-ink">Delivery details</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            <label className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</span>
              <input
                className="mt-1 rounded-2xl border-none bg-white/80 px-4 py-3 text-sm shadow-inner focus:ring-2 focus:ring-brand-200"
                defaultValue="Kololo, Kampala"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery note</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-1 min-h-[120px] rounded-2xl border-none bg-white/80 px-4 py-3 text-sm shadow-inner focus:ring-2 focus:ring-brand-200"
                placeholder="Ring the bell twice, leave at reception"
              />
            </label>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="glass-panel rounded-3xl p-6">
          <h3 className="text-lg font-semibold text-ink">Order summary</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {items.map((item) => (
              <div key={item.menuItemId} className="flex items-center justify-between">
                <span>
                  {item.quantity}× {item.name}
                </span>
                <span>UGX {item.subtotal.toLocaleString()}</span>
              </div>
            ))}
            <hr className="border-white/60" />
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>UGX {totals.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Delivery</span>
              <span>UGX {totals.delivery.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-ink">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold">UGX {totals.total.toLocaleString()}</span>
            </div>
          </div>
          {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || items.length === 0}
            whileTap={{ scale: 0.97 }}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Processing...' : 'Pay & place order'}
          </motion.button>
        </div>
      </div>
    </section>
  );
}
