import { motion } from 'framer-motion';

export default function MetricsPanel({ metrics }) {
  const cards = [
    { label: 'Total Orders', value: metrics.totalOrders, accent: 'from-brand-500 to-brand-600' },
    { label: 'Pending', value: metrics.pendingOrders, accent: 'from-amber-400 to-orange-500' },
    {
      label: 'Revenue Today',
      value: `UGX ${metrics.revenueToday.toLocaleString()}`,
      accent: 'from-emerald-400 to-teal-500'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="glass-panel rounded-3xl p-4"
        >
          <div className={`inline-flex rounded-full bg-gradient-to-r ${card.accent} px-3 py-1 text-xs font-semibold text-white`}>
            {card.label}
          </div>
          <p className="mt-4 text-3xl font-extrabold text-ink">{card.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
