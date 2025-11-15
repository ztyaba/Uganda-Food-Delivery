import { motion } from 'framer-motion';

const categories = [
  { name: 'Rolex', emoji: '🌯', description: 'Iconic Ugandan street food reinvented.' },
  { name: 'Matooke', emoji: '🍌', description: 'Slow-cooked plantain feasts.' },
  { name: 'BBQ & Grill', emoji: '🍖', description: 'Smoky flavours, sizzling platters.' },
  { name: 'Juices', emoji: '🧃', description: 'Cold-pressed freshness, always on tap.' },
  { name: 'Vegan', emoji: '🥗', description: 'Plant-powered delights and hearty bowls.' }
];

export default function LandingPage() {
  return (
    <section className="mt-12">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-ink">Browse Kampala&apos;s favourites</h2>
          <span className="text-sm text-slate-500">Swipe to explore categories</span>
        </div>
        <motion.div className="flex snap-x gap-4 overflow-x-auto pb-4">
          {categories.map((category, index) => (
            <motion.div
              key={category.name}
              className="glass-panel min-w-[220px] snap-center rounded-3xl p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              whileHover={{ y: -6 }}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{category.emoji}</span>
                <div>
                  <p className="text-lg font-semibold text-ink">{category.name}</p>
                  <p className="text-sm text-slate-500">{category.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
