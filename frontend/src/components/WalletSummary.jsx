import { motion } from 'framer-motion';

export default function WalletSummary({ wallet, title }) {
  if (!wallet) {
    return null;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-3xl p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{title}</p>
      <p className="mt-3 text-4xl font-black text-ink">UGX {wallet.balance.toLocaleString()}</p>
      <p className="mt-1 text-sm text-slate-500">Pending payout: UGX {wallet.pending.toLocaleString()}</p>
      <div className="mt-4 grid gap-3 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <span>Owner</span>
          <span className="font-semibold text-ink">{wallet.ownerName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Wallet ID</span>
          <span className="font-mono text-xs">{wallet.walletId}</span>
        </div>
      </div>
    </motion.div>
  );
}
