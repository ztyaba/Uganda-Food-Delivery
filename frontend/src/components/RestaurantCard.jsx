import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function RestaurantCard({ restaurant, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6 }}
      className="gradient-border rounded-3xl bg-gradient-card p-1"
    >
      <Link
        to={`/customer/restaurants/${restaurant.id}`}
        className="block h-full rounded-[calc(theme(borderRadius.3xl)+1px)] bg-white/80 shadow-card"
      >
        <div className="relative h-40 overflow-hidden rounded-t-[calc(theme(borderRadius.3xl)+1px)]">
          <motion.img
            src={restaurant.heroImage}
            alt={restaurant.name}
            className="h-full w-full object-cover"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.6 }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10" />
          <div className="absolute bottom-4 left-4 text-white">
            <p className="text-xl font-semibold drop-shadow-lg">{restaurant.name}</p>
            <span className="text-sm font-medium opacity-90">{restaurant.deliveryEta}</span>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{restaurant.cuisine}</span>
            <span className="flex items-center gap-1 font-semibold text-amber-500">
              ★ {restaurant.rating}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {restaurant.categories.map((category) => (
              <span
                key={category}
                className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
