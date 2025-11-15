import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const actions = [
  {
    title: 'Order as a customer',
    description: 'Discover Kampala favourites with real-time tracking and delightful micro-interactions.',
    to: '/customer',
    gradient: 'from-brand-500 to-brand-600'
  },
  {
    title: 'Manage as a vendor',
    description: 'Coordinate your kitchen, update order states, and manage payouts effortlessly.',
    to: '/vendor',
    gradient: 'from-emerald-500 to-teal-500'
  },
  {
    title: 'Deliver as a driver',
    description: 'Stay on top of pickups, navigation, and wallet balances with animated clarity.',
    to: '/driver',
    gradient: 'from-amber-500 to-orange-500'
  }
];

export default function HeroSection() {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.1fr,0.9fr]">
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <span className="rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-brand-600">
            Kampala&apos;s premier delivery platform
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-ink md:text-5xl">
            Crafted for diners, restaurants, and drivers in perfect sync.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Experience an elevated food delivery journey with cinematic motion, realtime dashboards, and delightful cart
            interactions across every role.
          </p>
        </motion.div>
        <div className="grid gap-4 md:grid-cols-3">
          {actions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="glass-panel flex flex-col justify-between rounded-3xl p-4"
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{action.title}</p>
                <p className="mt-2 text-sm text-slate-600">{action.description}</p>
              </div>
              <Link
                to={action.to}
                className={`mt-6 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r ${action.gradient} px-4 py-2 text-sm font-semibold text-white shadow-glow`}
              >
                Explore
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-1 shadow-glow"
      >
        <div className="glass-panel h-full rounded-[36px] bg-white/15 p-6 text-white">
          <p className="text-sm uppercase tracking-[0.4em] text-white/70">Live Orders</p>
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map((order) => (
              <motion.div
                key={order}
                className="rounded-3xl bg-white/10 p-4 backdrop-blur"
                animate={{ y: [0, -4, 0] }}
                transition={{ repeat: Infinity, duration: 6 + order, delay: order * 0.3 }}
              >
                <p className="text-sm font-semibold">Order #{500 + order}</p>
                <p className="text-xs text-white/70">Rolex Supreme • Delivering to Kololo</p>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <motion.div
                    className="h-2 rounded-full bg-white"
                    style={{ originX: 0 }}
                    animate={{ scaleX: [0.3, 0.9, 0.7] }}
                    transition={{ repeat: Infinity, duration: 5, delay: order * 0.5 }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
