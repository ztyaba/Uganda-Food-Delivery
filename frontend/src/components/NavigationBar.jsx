import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext.jsx';

const links = [
  { label: 'Customer', path: '/customer' },
  { label: 'Vendor', path: '/vendor' },
  { label: 'Driver', path: '/driver' }
];

export default function NavigationBar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const activeRoot = `/${location.pathname.split('/')[1]}`;

  return (
    <nav className="sticky top-0 z-30 backdrop-blur-2xl bg-white/70 border-b border-white/40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="group flex items-center gap-2 text-lg font-semibold">
          <motion.span
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow"
            animate={{ rotate: [0, 6, -6, 0] }}
            transition={{ repeat: Infinity, duration: 12, ease: 'easeInOut' }}
          >
            UF
          </motion.span>
          <span className="font-bold tracking-tight text-ink">
            Uganda Food Delivery
          </span>
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`relative text-sm font-medium transition ${
                activeRoot === link.path ? 'text-brand-600' : 'text-slate-500'
              }`}
            >
              {activeRoot === link.path && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute -inset-2 rounded-full bg-brand-50"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10 px-3 py-2">{link.label}</span>
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button className="glass-panel flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-ink">
                <span className="h-8 w-8 rounded-full bg-brand-500/10 text-center text-brand-600">
                  {user.fullName ? user.fullName.charAt(0) : user.email.charAt(0)}
                </span>
                <div className="text-left">
                  <p className="leading-none">{user.fullName || user.email}</p>
                  <span className="text-xs text-slate-500 capitalize">{user.role}</span>
                </div>
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-100"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-2xl bg-white p-2 shadow-card ring-1 ring-black/5 focus:outline-none">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={logout}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium ${
                          active ? 'bg-brand-50 text-brand-600' : 'text-slate-600'
                        }`}
                      >
                        Sign out
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Transition>
            </Menu>
          ) : (
            <Link
              to="/login/customer"
              className="glass-panel rounded-full px-4 py-2 text-sm font-semibold text-brand-600 shadow-card"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
