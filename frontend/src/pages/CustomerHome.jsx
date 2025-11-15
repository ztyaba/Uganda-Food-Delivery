import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi.js';
import RestaurantCard from '../components/RestaurantCard.jsx';

export default function CustomerHome() {
  const api = useApi();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .get('/customer/restaurants')
      .then((response) => {
        if (mounted) setRestaurants(response.data.restaurants);
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [api]);

  return (
    <section className="space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-black text-ink">Good evening, let&apos;s find dinner</h2>
          <p className="text-sm text-slate-500">
            Animated browsing, curated picks, and swift checkout keep your cravings satisfied.
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-full bg-white/90 px-5 py-2 text-xs font-semibold text-brand-600 shadow-card"
        >
          Pull to refresh on mobile for live updates
        </motion.div>
      </div>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, index) => (
            <motion.div
              key={index}
              className="h-56 animate-pulse rounded-3xl bg-white/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant, index) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}
