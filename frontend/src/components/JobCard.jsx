import { motion } from 'framer-motion';

export default function JobCard({
  order,
  onAccept,
  onPickedUp,
  onDelivered,
  onView,
  variant = 'available',
  disabled = false
}) {
  const restaurantLabel = order.restaurantName || order.restaurantId;
  const payoutValue = order.driverPayout != null ? order.driverPayout : order.driverShare;
  const dropOff = order.deliveryAddress || 'Customer address on file';

  return (
    <motion.div layout className="glass-panel flex flex-col gap-4 rounded-3xl p-4" whileHover={{ y: -4 }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-600">{restaurantLabel}</p>
          <p className="text-lg font-bold text-ink">UGX {order.total.toLocaleString()}</p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">{order.status}</span>
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
        <div className="text-xs">
          <p>Pickup: {restaurantLabel}</p>
          <p>Drop-off: {dropOff}</p>
        </div>
        {payoutValue != null && (
          <p className="text-xs font-semibold text-brand-600">Driver payout: UGX {Number(payoutValue).toLocaleString()}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {onView && (
          <button onClick={onView} className="rounded-full px-4 py-2 text-xs font-semibold text-slate-500 hover:text-brand-600">
            View
          </button>
        )}
        {variant === 'available' ? (
          <motion.button
            onClick={onAccept}
            whileTap={{ scale: 0.95 }}
            disabled={disabled}
            className={`rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow ${
              disabled ? 'opacity-60' : ''
            }`}
          >
            Accept Delivery
          </motion.button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-emerald-500">In progress</span>
            <motion.button
              onClick={onPickedUp}
              whileTap={{ scale: 0.95 }}
              disabled={disabled || order.status !== 'ready for pickup'}
              className={`rounded-2xl bg-white/80 px-4 py-2 text-xs font-semibold text-brand-600 shadow-card ${
                disabled || order.status !== 'ready for pickup' ? 'opacity-60' : ''
              }`}
            >
              Picked Up
            </motion.button>
            <motion.button
              onClick={onDelivered}
              whileTap={{ scale: 0.95 }}
              disabled={disabled || order.status !== 'on the way'}
              className={`rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-glow ${
                disabled || order.status !== 'on the way' ? 'opacity-60' : ''
              }`}
            >
              Delivered
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
