import { motion } from 'framer-motion';

const steps = ['received', 'preparing', 'ready for pickup', 'on the way', 'delivered'];

export default function OrderTimeline({ currentStatus }) {
  const currentIndex = steps.indexOf(currentStatus);

  return (
    <div className="relative">
      <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-brand-100" />
      <div className="space-y-6">
        {steps.map((step, index) => {
          const isActive = index <= currentIndex;
          return (
            <div key={step} className="flex items-start gap-4">
              <motion.div
                animate={{ scale: isActive ? 1 : 0.8, backgroundColor: isActive ? '#1d72ff' : 'rgba(148,163,184,0.4)' }}
                className="relative mt-1 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-card"
              >
                <motion.span animate={{ opacity: isActive ? 1 : 0.5 }} className="text-xs font-semibold">
                  {index + 1}
                </motion.span>
              </motion.div>
              <div className="rounded-3xl bg-white/80 px-4 py-3 shadow-card">
                <p className="text-sm font-semibold capitalize text-ink">{step}</p>
                <p className="text-xs text-slate-500">
                  {isActive ? 'In progress' : 'Pending'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
