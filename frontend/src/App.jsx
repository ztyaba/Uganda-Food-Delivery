import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import NavigationBar from './components/NavigationBar.jsx';
import HeroSection from './components/HeroSection.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import { useAuth } from './contexts/AuthContext.jsx';
import { usePageTransition } from './hooks/usePageTransition.js';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import CustomerHome from './pages/CustomerHome.jsx';
import CustomerRestaurant from './pages/CustomerRestaurant.jsx';
import CustomerCheckout from './pages/CustomerCheckout.jsx';
import CustomerTracking from './pages/CustomerTracking.jsx';
import CustomerProfile from './pages/CustomerProfile.jsx';
import VendorDashboard from './pages/VendorDashboard.jsx';
import VendorOrders from './pages/VendorOrders.jsx';
import VendorWallet from './pages/VendorWallet.jsx';
import DriverDashboard from './pages/DriverDashboard.jsx';
import DriverJobs from './pages/DriverJobs.jsx';
import DriverWallet from './pages/DriverWallet.jsx';

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    const role = roles[0];
    return <Navigate to={`/login/${role}`} state={{ from: location }} replace />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />;
  }
  return children;
}

function PageContainer({ children }) {
  const transition = usePageTransition();
  return (
    <motion.main className="mx-auto min-h-[calc(100vh-5rem)] max-w-6xl px-4 py-10" {...transition}>
      {children}
    </motion.main>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen pb-24">
      <NavigationBar />
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <PageContainer>
                <HeroSection />
                <LandingPage />
              </PageContainer>
            }
          />
          <Route
            path="/login/:role"
            element={
              <PageContainer>
                <LoginPage />
              </PageContainer>
            }
          />
          <Route
            path="/customer"
            element={
              <ProtectedRoute roles={['customer']}>
                <PageContainer>
                  <CustomerHome />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/restaurants/:id"
            element={
              <ProtectedRoute roles={['customer']}>
                <PageContainer>
                  <CustomerRestaurant />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/checkout"
            element={
              <ProtectedRoute roles={['customer']}>
                <PageContainer>
                  <CustomerCheckout />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/orders/:id"
            element={
              <ProtectedRoute roles={['customer']}>
                <PageContainer>
                  <CustomerTracking />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/profile"
            element={
              <ProtectedRoute roles={['customer']}>
                <PageContainer>
                  <CustomerProfile />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor"
            element={
              <ProtectedRoute roles={['vendor']}>
                <PageContainer>
                  <VendorDashboard />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/orders"
            element={
              <ProtectedRoute roles={['vendor']}>
                <PageContainer>
                  <VendorOrders />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/wallet"
            element={
              <ProtectedRoute roles={['vendor']}>
                <PageContainer>
                  <VendorWallet />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver"
            element={
              <ProtectedRoute roles={['driver']}>
                <PageContainer>
                  <DriverDashboard />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/jobs"
            element={
              <ProtectedRoute roles={['driver']}>
                <PageContainer>
                  <DriverJobs />
                </PageContainer>
              </ProtectedRoute>
            }
          />
          <Route
            path="/driver/wallet"
            element={
              <ProtectedRoute roles={['driver']}>
                <PageContainer>
                  <DriverWallet />
                </PageContainer>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AnimatePresence>
      <CartDrawer />
    </div>
  );
}
