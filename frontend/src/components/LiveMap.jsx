import { motion, useAnimation } from 'framer-motion';
import { useEffect } from 'react';

export default function LiveMap({ status }) {
  const controls = useAnimation();

  useEffect(() => {
    const sequence = async () => {
      await controls.start({ x: [0, 160, 280], y: [0, -20, 0], transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' } });
    };
    sequence();
  }, [controls]);

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-3xl bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v11/static/32.5825,0.3476,12,0/600x400?access_token=pk.eyJ1IjoiZGVtb3VzZXIiLCJhIjoiY2tzbWE1NDJzMGU4azJvbWg4cDd5cTh0OSJ9.7Vq0gA1g')]
      bg-cover bg-center">
      <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
      <motion.div
        animate={controls}
        className="absolute left-10 top-32 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-card"
      >
        <span className="text-xl">🛵</span>
      </motion.div>
      <div className="absolute bottom-4 right-4 rounded-2xl bg-white/80 px-4 py-2 text-sm font-semibold text-brand-600 shadow-card">
        Status: {status}
      </div>
    </div>
  );
}
