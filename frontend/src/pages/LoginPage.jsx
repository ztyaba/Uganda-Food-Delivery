import { useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext.jsx';

const roleHints = {
  customer: { email: 'customer@ugandafood.app', password: 'Customer#2024' },
  vendor: { email: 'vendor@ugandafood.app', password: 'Vendor#2024' },
  driver: { email: 'driver@ugandafood.app', password: 'Driver#2024' }
};

export default function LoginPage() {
  const { role = 'customer' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading } = useAuth();
  const [form, setForm] = useState(roleHints[role] || { email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await login(form.email, form.password);
      const redirectTo = location.state?.from?.pathname || `/${role}`;
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError('Sign in failed. Please double-check your credentials.');
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <span className="rounded-full bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-brand-600">
          Welcome back
        </span>
        <h2 className="text-4xl font-black text-ink">Sign in as a {role}</h2>
        <p className="text-sm text-slate-500">
          Use the demo credentials provided below or your own account to experience the premium dashboards tailored to each role.
        </p>
        <div className="space-y-2 text-sm text-slate-500">
          <p>Demo email: <span className="font-semibold text-brand-600">{roleHints[role]?.email}</span></p>
          <p>Demo password: <span className="font-semibold text-brand-600">{roleHints[role]?.password}</span></p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          {Object.keys(roleHints).map((key) => (
            <Link
              key={key}
              to={`/login/${key}`}
              className={`rounded-full px-4 py-2 transition ${
                key === role ? 'bg-brand-500 text-white shadow-glow' : 'bg-white/80 text-slate-500 shadow-card'
              }`}
            >
              {key}
            </Link>
          ))}
        </div>
      </motion.div>
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-panel rounded-3xl p-8 shadow-card"
      >
        <label className="block text-sm font-semibold text-slate-600">Email</label>
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          className="mt-2 w-full rounded-2xl border-none bg-white/80 px-4 py-3 text-sm shadow-inner focus:ring-2 focus:ring-brand-200"
          placeholder="you@example.com"
          required
        />
        <label className="mt-6 block text-sm font-semibold text-slate-600">Password</label>
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          className="mt-2 w-full rounded-2xl border-none bg-white/80 px-4 py-3 text-sm shadow-inner focus:ring-2 focus:ring-brand-200"
          placeholder="••••••••"
          required
        />
        {error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          className="mt-8 w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-glow"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </motion.button>
      </motion.form>
    </div>
  );
}
