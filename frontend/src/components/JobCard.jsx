import { motion } from 'framer-motion';

export default function JobCard({ order, onAccept, onView, onComplete, variant = 'available' }) {
  const restaurantLabel = order.restaurantName || order.restaurantId;
  return (
    <motion.div
      layout
      className="glass-panel flex flex-col gap-4 rounded-3xl p-4"
      whileHover={{ y: -4 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-600">{restaurantLabel}</p>
          <p className="text-lg font-bold text-ink">UGX {order.total.toLocaleString()}</p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
          {order.status}
        </span>
      </div>
      <div className="space-y-2 text-sm text-slate-500">
        {order.items.slice(0, 2).map((item) => (
          <div key={item.menuItemId} className="flex items-center justify-between">
            <span>
              {item.quantity}× {item.name}
            </span>
            <span>UGX {item.subtotal.toLocaleString()}</span>
          </div>
        ))}
        {order.items.length > 2 && <p>+{order.items.length - 2} more items</p>}
      </div>
      <div className="flex items-center justify-end gap-3">
        {onView && (
          <button
            onClick={onView}
            className="rounded-full px-4 py-2 text-xs font-semibold text-slate-500 hover:text-brand-600"
          >
            View
          </button>
        )}
        {variant === 'available' ? (
          <motion.button
            onClick={onAccept}
            whileTap={{ scale: 0.95 }}
            className="rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow"
          >
            Accept job
          </motion.button>
        ) : (
          <>
            <span className="text-xs font-semibold text-emerald-500">In progress</span>
            {onComplete && (
              <motion.button
                onClick={onComplete}
                whileTap={{ scale: 0.95 }}
                className="rounded-2xl bg-white/80 px-4 py-2 text-xs font-semibold text-brand-600 shadow-card"
              >
                Mark delivered
              </motion.button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
