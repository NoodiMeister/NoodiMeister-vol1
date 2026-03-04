import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
// Lazy load, et vältida TDZ-viga ühes suures bundle'is
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const HinnakiriPage = lazy(() => import('./pages/HinnakiriPage'));
const ToetaPage = lazy(() => import('./pages/ToetaPage'));
const MinuToodPage = lazy(() => import('./pages/MinuTöödPage'));
const NoodiMeister = lazy(() => import('./noodimeister-complete'));

import * as authStorage from './services/authStorage';

/** Kas kasutaja on endiselt sisse logitud (pole välja loginud). */
function isLoggedIn() {
  return authStorage.isLoggedIn();
}

/** Esilehe asemel suuna sisselogitud kasutaja otse Minu tööde lehele. */
function LandingOrRedirect() {
  if (isLoggedIn()) return <Navigate to="/tood" replace />;
  return <LandingPage />;
}

/** Login/Registreeru lehel suuna juba sisselogitud kasutaja Minu tööde lehele. */
function LoginOrRedirect() {
  if (isLoggedIn()) return <Navigate to="/tood" replace />;
  return <LoginPage />;
}

function RegisterOrRedirect() {
  if (isLoggedIn()) return <Navigate to="/tood" replace />;
  return <RegisterPage />;
}

function ErrorFallback({ error }) {
  return (
    <div style={{ padding: 24, background: '#fef2f2', color: '#991b1b', fontFamily: 'sans-serif' }}>
      <h2>Viga</h2>
      <pre style={{ overflow: 'auto' }}>{error?.message || 'Tundmatu viga'}</pre>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}

/** Riba, et arendaja näeks, kas ta on test- või toodangukeskkonnas. Toodangus ei ilmu. */
function EnvBanner() {
  const vercelEnv = import.meta.env.VITE_VERCEL_ENV;
  const isLocal = typeof window !== 'undefined' && /^localhost$|^127\.0\.0\.1$/.test(window.location?.hostname || '');
  if (vercelEnv === 'production') return null;
  if (vercelEnv === 'preview') {
    return (
      <div
        role="status"
        aria-label="Testiversioon"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'linear-gradient(90deg, #b45309 0%, #92400e 100%)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          textAlign: 'center',
          padding: '6px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        TEST – see on testiversioon. Kasutajate andmeid ei mõjuta. Toodang: noodimeister.ee
      </div>
    );
  }
  if (isLocal) {
    return (
      <div
        role="status"
        aria-label="Kohalik arendus"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'linear-gradient(90deg, #065f46 0%, #047857 100%)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          textAlign: 'center',
          padding: '6px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        Kohalik arendus – muudatused ei ilmu veebilehele
      </div>
    );
  }
  return null;
}

function AppRoutes() {
  const location = useLocation();
  const pathname = location.pathname || '/';

  const needBannerSpace = import.meta.env.VITE_VERCEL_ENV === 'preview' ||
    (typeof window !== 'undefined' && /^localhost$|^127\.0\.0\.1$/.test(window.location?.hostname || ''));

  return (
    <div key={pathname} style={{ minHeight: '100vh', isolation: 'isolate', paddingTop: needBannerSpace ? 40 : 0 }}>
      <EnvBanner />
      <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Laen…</div>}>
        <Routes>
          <Route path="/app" element={<NoodiMeister />} />
          <Route path="/tood" element={<MinuToodPage />} />
          <Route path="/login" element={<LoginOrRedirect />} />
          <Route path="/registreeru" element={<RegisterOrRedirect />} />
          <Route path="/hinnakiri" element={<HinnakiriPage />} />
          <Route path="/toeta" element={<ToetaPage />} />
          <Route path="/" element={<LandingOrRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL || '/'}>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
