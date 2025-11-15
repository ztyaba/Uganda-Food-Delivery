import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi.js';
import DishCard from '../components/DishCard.jsx';

export default function CustomerRestaurant() {
  const { id } = useParams();
  const api = useApi();
  const [restaurant, setRestaurant] = useState(null);

  useEffect(() => {
    api.get(`/customer/restaurants/${id}`).then((response) => setRestaurant(response.data.restaurant));
  }, [api, id]);

  if (!restaurant) {
    return <div className="h-32 animate-pulse rounded-3xl bg-white/70" />;
  }

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[40px] shadow-card">
        <motion.img
          src={restaurant.heroImage}
          alt={restaurant.name}
          className="h-64 w-full object-cover"
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <h2 className="text-3xl font-black">{restaurant.name}</h2>
          <p className="text-sm text-white/80">{restaurant.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-white/80">
            <span className="rounded-full bg-white/15 px-3 py-1">{restaurant.cuisine}</span>
            <span className="rounded-full bg-white/15 px-3 py-1">Rating {restaurant.rating}</span>
            <span className="rounded-full bg-white/15 px-3 py-1">{restaurant.deliveryEta}</span>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {restaurant.menu.map((dish) => (
          <DishCard key={dish.id} dish={dish} restaurant={restaurant} />
        ))}
      </div>
    </section>
  );
}
