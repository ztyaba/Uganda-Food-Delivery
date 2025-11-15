import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi.js';
import WalletSummary from '../components/WalletSummary.jsx';

export default function DriverWallet() {
  const api = useApi();
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('Mobile Money');

  const load = useCallback(() => {
    api.get('/wallet/me').then((response) => setWallet(response.data.wallet));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const requestPayout = async () => {
    if (!amount) return;
    try {
      await api.post('/wallet/driver/payout', { amount: Number(amount), destination: provider });
      setStatus('Withdrawal requested. Expect confirmation soon.');
      setAmount('');
      load();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Unable to request payout');
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
      <WalletSummary wallet={wallet} title="Driver wallet" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-3xl p-6">
        <h3 className="text-lg font-semibold text-ink">Send earnings</h3>
        <div className="mt-4 grid gap-3 text-sm text-slate-600">
          <label className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              type="number"
              className="mt-1 rounded-2xl border-none bg-white/80 px-4 py-3 text-sm shadow-inner focus:ring-2 focus:ring-brand-200"
              placeholder="40000"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="mt-1 rounded-2xl border-none bg-white/80 px-4 py-3 text-sm shadow-inner focus:ring-2 focus:ring-brand-200"
            >
              <option>Mobile Money</option>
              <option>CashApp</option>
              <option>Venmo</option>
            </select>
          </label>
        </div>
        <motion.button
          type="button"
          onClick={requestPayout}
          whileTap={{ scale: 0.97 }}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-glow"
        >
          Request payout
        </motion.button>
        {status && <p className="mt-4 text-sm text-brand-600">{status}</p>}
      </motion.div>
    </section>
  );
}
