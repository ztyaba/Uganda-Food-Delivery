import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../contexts/CartContext.jsx';
import { Link } from 'react-router-dom';

export default function CartDrawer() {
  const { items, totals, isOpen, toggle, removeItem } = useCart();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed bottom-4 right-4 z-40 w-80 max-w-full"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 240, damping: 28 }}
        >
          <div className="glass-panel rounded-3xl p-4 shadow-glow">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">Your Cart</h3>
              <button
                onClick={() => toggle(false)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500"
              >
                Close
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">Add dishes to start your order.</p>
              ) : (
                items.map((item) => (
                  <motion.div
                    key={item.menuItemId}
                    layout
                    className="flex items-center justify-between rounded-2xl bg-white/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.name}</p>
                      <span className="text-xs text-slate-500">
                        {item.quantity} × UGX {item.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">
                        UGX {item.subtotal.toLocaleString()}
                      </span>
                      <button
                        onClick={() => removeItem(item.menuItemId)}
                        className="text-xs font-semibold text-brand-500"
                      >
                        Remove
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
            <motion.div layout className="mt-4 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>UGX {totals.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>UGX {totals.delivery.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-ink">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">UGX {totals.total.toLocaleString()}</span>
              </div>
            </motion.div>
            <Link
              to="/customer/checkout"
              onClick={() => toggle(false)}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow"
            >
              Proceed to checkout
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
