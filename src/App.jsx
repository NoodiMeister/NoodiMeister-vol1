import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
// Lazy load, et vältida TDZ-viga ühes suures bundle'is
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const HinnakiriPage = lazy(() => import('./pages/HinnakiriPage'));
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

function AppRoutes() {
  const location = useLocation();
  const pathname = location.pathname || '/';

  return (
    <div key={pathname} style={{ minHeight: '100vh', isolation: 'isolate' }}>
      <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Laen…</div>}>
        <Routes>
          <Route path="/app" element={<NoodiMeister />} />
          <Route path="/tood" element={<MinuToodPage />} />
          <Route path="/login" element={<LoginOrRedirect />} />
          <Route path="/registreeru" element={<RegisterOrRedirect />} />
          <Route path="/hinnakiri" element={<HinnakiriPage />} />
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
