import { motion } from 'framer-motion';
import { useCart } from '../contexts/CartContext.jsx';

export default function DishCard({ dish, restaurant }) {
  const { addItem } = useCart();

  const handleAdd = () => {
    addItem(
      {
        menuItemId: dish.id,
        name: dish.name,
        price: dish.price,
        quantity: 1,
        subtotal: dish.price
      },
      restaurant
    );
  };

  return (
    <motion.button
      onClick={handleAdd}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -4 }}
      className="flex items-center gap-4 rounded-3xl bg-white/80 p-4 text-left shadow-card transition"
    >
      <div className="relative h-20 w-20 overflow-hidden rounded-3xl">
        <motion.img
          src={dish.image}
          alt={dish.name}
          className="h-full w-full object-cover"
          whileHover={{ scale: 1.05 }}
        />
      </div>
      <div className="flex-1">
        <p className="text-lg font-semibold text-ink">{dish.name}</p>
        <p className="text-sm text-slate-500">{dish.description}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-base font-semibold text-brand-600">UGX {dish.price.toLocaleString()}</span>
          <motion.span
            className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            Tap to add
          </motion.span>
        </div>
      </div>
    </motion.button>
  );
}
