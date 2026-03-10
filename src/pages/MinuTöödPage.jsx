import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePlus, FolderOpen, Cloud, LogIn, Loader2 } from 'lucide-react';
import * as googleDrive from '../services/googleDrive';
import * as authStorage from '../services/authStorage';

/** Error Boundary: sisselogimise järgne vaade – punane kast veateatega */
class MinuToodErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      return (
        <div
          style={{
            background: '#fef2f2',
            color: '#991b1b',
            border: '2px solid #dc2626',
            padding: 24,
            margin: 24,
            borderRadius: 8,
            fontFamily: 'sans-serif',
          }}
        >
          <strong>Viga rakenduse käivitamisel:</strong> {msg}
        </div>
      );
    }
    return this.props.children;
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('et-EE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function MinuTöödPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    try {
      setUser(authStorage.getLoggedInUser());
    } catch (_) {
      setUser(null);
    }
    setAuthReady(true);
  }, []);

  const token = googleDrive.getStoredToken();
  const hasGoogle = !!token;

  const loadFiles = useCallback(async () => {
    if (!token) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await googleDrive.listNoodimeisterFiles(token);
      setFiles(list);
    } catch (e) {
      setError(e?.message || 'Tööde laadimine ebaõnnestus');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (authReady && !user) navigate('/login', { replace: true });
  }, [authReady, user, navigate]);

  if (!authReady || !user) {
    return <div className="loading-screen">Laen Noodimeistrit…</div>;
  }

  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const basePath = base.replace(/\/$/, '') || '';
  const hrefNew = `${basePath}/app?new=1`;
  const hrefLocal = `${basePath}/app?local=1`;

  return (
    <MinuToodErrorBoundary>
    <div
      className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100"
      style={{ position: 'relative', zIndex: 1, pointerEvents: 'auto' }}
    >
      <header className="flex-shrink-0 border-b border-amber-200/60 bg-white/70 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="NoodiMeister" className="h-9 w-auto" />
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/app" className="text-amber-700 hover:text-amber-900 font-medium">Tööriist</Link>
            <Link to="/" className="text-amber-700 hover:text-amber-900 font-medium">Esileht</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        <h1 className="text-2xl font-bold text-amber-900 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
          Minu tööd
        </h1>
        <p className="text-amber-800/90 mb-8">
          Siin on loetelu sinu Google Drive’is salvestatud NoodiMeister-failidest. Vali töö avamiseks või alusta uut.
        </p>

        {!hasGoogle && (
          <div className="rounded-xl bg-amber-100/80 border border-amber-200/60 p-6 mb-8">
            <div className="flex items-start gap-3">
              <Cloud className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-amber-900 mb-1">Pilves salvestatud tööd</h2>
                <p className="text-sm text-amber-800/90 mb-4">
                  Logi sisse Google’iga, et näha ja avada oma pilves (Google Drive) salvestatud töid.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors"
                >
                  <LogIn className="w-4 h-4" /> Logi sisse Google’iga
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-amber-900 mb-3">Viimati muudetud tööd</h2>
          <p className="text-sm text-amber-800/90 mb-4">
            Brauseris salvestatud viimane töö. Ava see, et jätkata kohalikult salvestatud tööga.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href={hrefNew}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold shadow-lg hover:shadow-xl hover:from-amber-500 hover:to-orange-500 transition-all no-underline"
            >
              <FilePlus className="w-5 h-5" /> Uus töö
            </a>
            <a
              href={hrefLocal}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-amber-400 bg-white text-amber-800 font-semibold hover:bg-amber-50 transition-colors no-underline"
            >
              <FolderOpen className="w-5 h-5" /> Ava viimati muudetud töö
            </a>
          </div>
        </div>

        {hasGoogle && (
          <section>
            <h2 className="text-lg font-semibold text-amber-900 mb-3">Pilves salvestatud failid (Google Drive)</h2>
            {loading && (
              <div className="flex items-center gap-2 text-amber-700 py-8">
                <Loader2 className="w-5 h-5 animate-spin" /> Laen töid…
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 p-4 mb-4">
                {error}
              </div>
            )}
            {!loading && !error && files.length === 0 && (
              <p className="text-amber-700/90 py-6">Pilves pole veel ühtegi NoodiMeister-faili. Kasuta tööriistas „Pilve salvesta“, et salvestada töid Google Drive’i.</p>
            )}
            {!loading && files.length > 0 && (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li key={f.id}>
                    <a
                      href={`${basePath}/app?fileId=${encodeURIComponent(f.id)}`}
                      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-amber-200/60 shadow-sm hover:bg-amber-50 hover:border-amber-300 transition-colors no-underline text-inherit"
                    >
                      <span className="font-medium text-amber-900 truncate flex-1">{f.name}</span>
                      <span className="text-sm text-amber-600 flex-shrink-0">{formatDate(f.modifiedTime)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
    </MinuToodErrorBoundary>
  );
}
