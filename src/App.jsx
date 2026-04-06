import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { NoodimeisterProvider, useNoodimeisterOptional } from './store/NoodimeisterContext';
import { lazyWithRetry } from './utils/lazyWithRetry';
import LandingPage from './pages/LandingPage';
// Lazy load, et vältida TDZ-viga ühes suures bundle'is; chunk load error → üks taaskoormus
const RegisterPage = lazyWithRetry(() => import('./pages/RegisterPage'));
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'));
const HinnakiriPage = lazyWithRetry(() => import('./pages/HinnakiriPage'));
const ToetaPage = lazyWithRetry(() => import('./pages/ToetaPage'));
const AdminGrantSupportPage = lazyWithRetry(() => import('./pages/AdminGrantSupportPage'));
const AdminRegistrationPage = lazyWithRetry(() => import('./pages/AdminRegistrationPage'));
const UserDashboard = lazyWithRetry(() => import('./components/UserDashboard'));
const AccountPage = lazyWithRetry(() => import('./pages/AccountPage'));
const NoodiMeister = lazyWithRetry(() => import('./noodimeister-complete'));
const PianoDemoPage = lazyWithRetry(() => import('./pages/PianoDemoPage'));
const SymbolGalleryPage = lazyWithRetry(() => import('./pages/SymbolGalleryPage'));
const FigurenotesSymbolGalleryPage = lazyWithRetry(() => import('./pages/FigurenotesSymbolGalleryPage'));
const DemoIntroPage = lazyWithRetry(() => import('./pages/DemoIntroPage'));

import * as authStorage from './services/authStorage';
import { IntroCrossfadeProvider } from './context/IntroCrossfadeContext';
import { SHOW_SUPPORT_AND_PRICING_UI } from './config/productFlags';

/** Esc vajutamine logib sisselogitud kasutaja välja ja suunab avalehele. */
function EscapeLogoutHandler() {
  const navigate = useNavigate();
  const store = useNoodimeisterOptional();
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      // Kui kasutaja parasjagu kirjutab (input/textarea/contentEditable), siis ära logi välja.
      // Muidu katkestab Escape tekstikasti/pealkirja redigeerimise.
      const el = e.target;
      const tag = el?.tagName;
      const isTypingTarget = tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable;
      if (isTypingTarget) return;
      if (!authStorage.isLoggedIn()) return;
      if (store) store.logout();
      else authStorage.clearAuth();
      navigate('/', { replace: true });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, store]);
  return null;
}

/** Kas kasutaja on endiselt sisse logitud (pole välja loginud). */
function isLoggedIn() {
  return authStorage.isLoggedIn();
}

/** Login peab avanema alati otse, et kasutaja saaks kontot vahetada ilma vahepealse konto-leheta. */
function LoginOrRedirect() {
  return <LoginPage />;
}

function RegisterOrRedirect() {
  return <RegisterPage />;
}

/** Minu tööd on sisselogimise järgne vaade – suuna sisselogimata kasutaja loginile. */
function MinuToodOrRedirect() {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return <UserDashboard />;
}

/** Minu konto – näitab kasutaja infot ja pilvesalvestuse (Google, OneDrive) olekut. */
function AccountOrRedirect() {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return <AccountPage />;
}

/** Drive "Ava koos" saadab state=JSON; siin teisendame selle fileId-ks ja suuname /app?fileId=... */
function parseDriveState(stateParam) {
  if (!stateParam || typeof stateParam !== 'string') return null;
  try {
    const decoded = decodeURIComponent(stateParam);
    const data = JSON.parse(decoded);
    const ids = data?.ids;
    if (Array.isArray(ids) && ids.length > 0 && ids[0]) return ids[0];
    return null;
  } catch {
    return null;
  }
}

/** Sisselogitud kasutaja suuna /app pealt Minu tööde vaatesse, kui ei avata konkreetset faili, uut tööd ega viimati muudetud tööd (local=1). */
function AppOrRedirect() {
  const [searchParams] = useSearchParams();
  let fileId = searchParams.get('fileId');
  const stateParam = searchParams.get('state');
  if (!fileId && stateParam) {
    const idFromState = parseDriveState(stateParam);
    if (idFromState) return <Navigate to={`/app?fileId=${encodeURIComponent(idFromState)}`} replace />;
  }
  const isNew = searchParams.get('new') === '1';
  const openLocal = searchParams.get('local') === '1';
  if (isLoggedIn() && !fileId && !isNew && !openLocal) return <Navigate to="/konto" replace />;
  return <NoodiMeister />;
}

/** ErrorBoundary ümbritseb kogu rakenduse; püüab renderdamise vead ja näitab kasutajale selge veateate. */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Vea saatmine administraatorile: logi konsooli ja valmista ette payload (nt. POST /api/log-error).
    console.error('[ErrorBoundary] Viga püütud, saadan info administraatorile:', error, errorInfo);
    // Näide: fetch('/api/log-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: error?.message, stack: error?.stack, componentStack: errorInfo?.componentStack }) });
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || '';
      const isChunkError = /failed to fetch dynamically imported module|loading chunk.*failed|importing a module script failed/i.test(msg);
      return (
        <div className="error-screen" style={{ padding: 50, textAlign: 'center', fontFamily: 'sans-serif', minHeight: '100vh', boxSizing: 'border-box', background: '#fef2f2', color: '#991b1b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1>Hups! Tehniline viga.</h1>
          <p style={{ marginTop: 12, fontSize: 16 }}>
            {isChunkError
              ? 'Rakendus on uuendatud. Värskenda lehte (F5 või nupp all), et laadida uus versioon.'
              : <>Teade on edastatud arendajale. Viga: {msg || 'tundmatu'}.</>}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => window.history.back()} style={{ padding: '12px 24px', cursor: 'pointer', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600 }}>
              Mine tagasi
            </button>
            <button type="button" onClick={() => window.location.reload()} style={{ padding: '12px 24px', cursor: 'pointer', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600 }}>
              Värskenda lehte
            </button>
          </div>
        </div>
      );
    }
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
          pointerEvents: 'none',
          background: 'linear-gradient(90deg, #b45309 0%, #92400e 100%)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          textAlign: 'center',
          padding: '6px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        TEST – see on testiversioon. Kasutajate andmeid ei mõjuta. Toodang:{' '}
        <a
          href="https://www.noodimeister.ee"
          target="_blank"
          rel="noopener noreferrer"
          style={{ pointerEvents: 'auto', color: '#fff', textDecoration: 'underline', fontWeight: 700 }}
        >
          noodimeister.ee
        </a>
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
          pointerEvents: 'none',
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

  // Pärast edukat laadimist võta chunk-retry lipu maha, et järgmine deploy võiks uuesti reloadida
  useEffect(() => {
    try {
      sessionStorage.removeItem('nm_chunk_reload_retry');
    } catch (_) { /* ignore */ }
  }, []);

  const needBannerSpace = import.meta.env.VITE_VERCEL_ENV === 'preview' ||
    (typeof window !== 'undefined' && /^localhost$|^127\.0\.0\.1$/.test(window.location?.hostname || ''));

  // Don't use key={pathname}: it forces the whole tree to remount on every route change,
  // so when the user presses the browser back button, the previous page remounts from scratch
  // and loses layout/setup (scroll, panels, view options). Routes still unmount/mount per route.
  return (
    <div style={{ minHeight: '100vh', isolation: 'isolate', paddingTop: needBannerSpace ? 40 : 0 }}>
      <EscapeLogoutHandler />
      <EnvBanner />
      <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Laen…</div>}>
        <Routes>
          <Route path="/app" element={<AppOrRedirect />} />
          <Route path="/demo-noodid" element={<NoodiMeister demoVisibility />} />
          <Route path="/demo-intro" element={<DemoIntroPage />} />
          {/* Part window (separate browser tab/window): renders editor, filtered by ?staffId=... */}
          <Route path="/part" element={<NoodiMeister />} />
          <Route path="/gallery/figurenotes" element={<FigurenotesSymbolGalleryPage />} />
          <Route path="/gallery" element={<SymbolGalleryPage />} />
          <Route path="/piano" element={<PianoDemoPage />} />
          <Route path="/tood" element={<MinuToodOrRedirect />} />
          <Route path="/konto" element={<AccountOrRedirect />} />
          <Route path="/login" element={<LoginOrRedirect />} />
          <Route path="/registreeru" element={<RegisterOrRedirect />} />
          <Route
            path="/hinnakiri"
            element={SHOW_SUPPORT_AND_PRICING_UI ? <HinnakiriPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/toeta"
            element={SHOW_SUPPORT_AND_PRICING_UI ? <ToetaPage /> : <Navigate to="/" replace />}
          />
          <Route path="/administraator" element={<AdminGrantSupportPage />} />
          <Route path="/administraator/register" element={<AdminRegistrationPage />} />
          <Route path="/administraator-registreerimine" element={<Navigate to="/administraator/register" replace />} />
          <Route path="/admin" element={<Navigate to="/administraator" replace />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/" element={<Navigate to="/demo-intro" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <NoodimeisterProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL || '/'}>
          <IntroCrossfadeProvider>
            <AppRoutes />
          </IntroCrossfadeProvider>
        </BrowserRouter>
      </NoodimeisterProvider>
    </ErrorBoundary>
  );
}
