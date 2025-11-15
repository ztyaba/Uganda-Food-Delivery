import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext.jsx';
import WalletSummary from '../components/WalletSummary.jsx';

export default function CustomerProfile() {
  const { user, refreshProfile } = useAuth();

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  if (!user) return null;

  return (
    <section className="grid gap-6 md:grid-cols-[0.6fr,1.4fr]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-3xl p-6"
      >
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/10 text-3xl text-brand-600">
            {user.fullName?.charAt(0) || 'C'}
          </span>
          <h2 className="text-xl font-semibold text-ink">{user.fullName}</h2>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
        <div className="mt-6 space-y-3 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Role</span>
            <span className="font-semibold capitalize text-brand-600">{user.role}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Member since</span>
            <span>2024</span>
          </div>
        </div>
      </motion.div>
      <WalletSummary wallet={user.wallet} title="Wallet balance" />
    </section>
  );
}
