import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePlus, FolderOpen, Cloud, LogIn, Loader2, Globe, User, Settings, ChevronDown, Trash2 } from 'lucide-react';
import * as googleDrive from '../services/googleDrive';
import * as oneDrive from '../services/oneDrive';
import * as authStorage from '../services/authStorage';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, LOCALES, getTranslations } from '../i18n';
import { useNoodimeisterOptional } from '../store/NoodimeisterContext';

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

function formatOneDriveDate(item) {
  return formatDate(item?.lastModifiedDateTime);
}

export default function MinuTöödPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [oneDriveFiles, setOneDriveFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [oneDriveLoading, setOneDriveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [oneDriveError, setOneDriveError] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [locale, setLocaleState] = useState(() => {
    try {
      return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const store = useNoodimeisterOptional();
  const themeMode = store?.theme?.mode ?? 'light';
  const setThemeMode = (mode) => { if (store?.setTheme) store.setTheme(mode); };
  const t = getTranslations(locale);

  useEffect(() => {
    const close = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false);
    };
    if (settingsOpen) {
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [settingsOpen]);

  useEffect(() => {
    try {
      setUser(authStorage.getLoggedInUser());
    } catch (_) {
      setUser(null);
    }
    setAuthReady(true);
  }, []);

  const token = googleDrive.getStoredToken();
  const microsoftToken = authStorage.getStoredMicrosoftTokenFromAuth();
  const hasGoogle = !!token;
  const hasMicrosoft = !!microsoftToken;
  const provider = user?.provider || (hasGoogle ? 'google' : hasMicrosoft ? 'microsoft' : null);

  const loadFiles = useCallback(async () => {
    if (!token) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const folderId = authStorage.getGoogleSaveFolderId();
      const list = await googleDrive.listNoodimeisterFiles(token, folderId ? { folderId } : {});
      setFiles(list);
    } catch (e) {
      setError(e?.message || 'Tööde laadimine ebaõnnestus');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadOneDriveFiles = useCallback(async () => {
    if (!microsoftToken) {
      setOneDriveFiles([]);
      setOneDriveLoading(false);
      return;
    }
    setOneDriveLoading(true);
    setOneDriveError(null);
    try {
      const folderId = authStorage.getOneDriveSaveFolderId();
      const result = await oneDrive.listNoodimeisterFilesFromOneDrive(microsoftToken, folderId || undefined);
      if (result.ok) setOneDriveFiles(result.files || []);
      else setOneDriveError(result.error || '');
    } catch (e) {
      setOneDriveError(e?.message || 'OneDrive laadimine ebaõnnestus');
      setOneDriveFiles([]);
    } finally {
      setOneDriveLoading(false);
    }
  }, [microsoftToken]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);
  useEffect(() => {
    loadOneDriveFiles();
  }, [loadOneDriveFiles]);

  const setLocale = (code) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, code);
      setLocaleState(code);
    } catch (_) {}
  };

  const handleDeleteGoogleFile = useCallback(async (fileId, fileName) => {
    const msg = (t['file.deleteConfirm'] || 'Kas kustutame faili "{name}"? Seda ei saa tagasi võtta.').replace('{name}', fileName || '');
    if (!window.confirm(msg)) return;
    if (!token) return;
    try {
      await googleDrive.deleteFile(token, fileId);
      loadFiles();
    } catch (e) {
      setError(e?.message || 'Kustutamine ebaõnnestus');
    }
  }, [token, loadFiles, t]);

  const handleDeleteOneDriveFile = useCallback(async (fileId, fileName) => {
    const msg = (t['file.deleteConfirm'] || 'Kas kustutame faili "{name}"? Seda ei saa tagasi võtta.').replace('{name}', fileName || '');
    if (!window.confirm(msg)) return;
    if (!microsoftToken) return;
    try {
      await oneDrive.deleteFile(microsoftToken, fileId);
      loadOneDriveFiles();
    } catch (e) {
      setOneDriveError(e?.message || 'Kustutamine ebaõnnestus');
    }
  }, [microsoftToken, loadOneDriveFiles, t]);

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
      className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black"
      style={{ position: 'relative', zIndex: 1, pointerEvents: 'auto' }}
    >
      <header className="flex-shrink-0 border-b border-amber-200/60 dark:border-white/20 bg-white/70 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="NoodiMeister" className="h-9 w-auto" />
          </Link>
          <nav className="flex items-center gap-3 flex-wrap" ref={settingsRef}>
            {/* Seaded – keel ja värvirežiim */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm bg-amber-100/80 dark:bg-white/10 text-amber-900 dark:text-white border border-amber-200 dark:border-white/20 hover:bg-amber-200/80 dark:hover:bg-white/20 transition-colors"
                title={t['settings.title'] || 'Seaded'}
                aria-expanded={settingsOpen}
              >
                <Settings className="w-4 h-4" />
                <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-1 min-w-[200px] py-2 rounded-xl bg-white dark:bg-zinc-900 border-2 border-amber-200 dark:border-white/20 shadow-xl z-50">
                  <div className="px-3 py-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wider">{t['app.language'] || 'Keel'}</div>
                  <div className="flex gap-0.5 px-2 pb-2">
                    {LOCALES.map(({ code, name }) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => { setLocale(code); setSettingsOpen(false); }}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${locale === code ? 'bg-amber-500 text-white' : 'text-amber-800 hover:bg-amber-100'}`}
                        title={name}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-amber-200 my-1" />
                  <div className="px-3 py-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wider">{t['app.theme'] || 'Värvirežiim'}</div>
                  <div className="flex gap-1 px-2">
                    <button
                      type="button"
                      onClick={() => { setThemeMode('light'); setSettingsOpen(false); }}
                      className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${themeMode === 'light' ? 'bg-amber-500 text-white' : 'text-amber-800 hover:bg-amber-100'}`}
                    >
                      {t['theme.light'] || 'Hele'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setThemeMode('dark'); setSettingsOpen(false); }}
                      className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${themeMode === 'dark' ? 'bg-amber-500 text-white' : 'text-amber-800 hover:bg-amber-100'}`}
                    >
                      {t['theme.dark'] || 'Tume'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <Link to="/app" className="text-amber-700 dark:text-white hover:text-amber-900 dark:hover:text-white/90 p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-white/10 transition-colors" aria-label="Tööriist" title="Tööriist">
              <Globe className="w-5 h-5" />
            </Link>
            <Link to="/konto" className="text-amber-700 hover:text-amber-900 p-1.5 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1" title="Minu konto">
              <User className="w-5 h-5" /> Minu konto
            </Link>
            <Link to="/" className="text-amber-700 hover:text-amber-900 font-medium">Esileht</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        <h1 className="text-2xl font-bold text-amber-900 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
          Minu tööd
        </h1>
        <p className="text-amber-800/90 mb-2">
          Siin on sinu pilves (Google Drive või OneDrive) ja kohalikult salvestatud tööd. Vali töö avamiseks või alusta uut.
        </p>
        {(provider === 'google' || provider === 'microsoft') && (
          <p className="text-sm text-amber-700/90 mb-6 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Salvestuskoht: {provider === 'microsoft' ? 'OneDrive' : 'Google Drive'}
            {' · '}
            <Link to="/konto" className="text-amber-800 font-medium hover:underline">Minu konto</Link>
            {' – vaata või muuda salvestuskeskkonda.'}
          </p>
        )}
        {!hasGoogle && !hasMicrosoft && (
          <div className="rounded-xl bg-amber-100/80 dark:bg-zinc-900 dark:border-white/20 border border-amber-200/60 p-6 mb-8">
            <div className="flex items-start gap-3">
              <Cloud className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-amber-900 mb-1">Pilves salvestatud tööd</h2>
                <p className="text-sm text-amber-800/90 mb-4">
                  Logi sisse Google’i või Microsoftiga, et näha ja avada oma pilves (Google Drive või OneDrive) salvestatud töid.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors"
                >
                  <LogIn className="w-4 h-4" /> Logi sisse
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
                  <li key={f.id} className="flex items-center gap-2">
                    <a
                      href={`${basePath}/app?fileId=${encodeURIComponent(f.id)}`}
                      className="flex-1 min-w-0 text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-white/20 shadow-sm hover:bg-amber-50 dark:hover:bg-white/10 hover:border-amber-300 dark:hover:border-white/30 transition-colors no-underline text-inherit text-amber-900 dark:text-white"
                    >
                      <img src="/logo.png" alt="" className="h-8 w-8 flex-shrink-0 object-contain" aria-hidden />
                      <span className="font-medium text-amber-900 truncate flex-1">{f.name}</span>
                      <span className="text-sm text-amber-600 flex-shrink-0">{formatDate(f.modifiedTime)}</span>
                    </a>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); handleDeleteGoogleFile(f.id, f.name); }}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-200 transition-colors"
                      title={t['file.delete'] || 'Kustuta fail'}
                      aria-label={t['file.delete'] || 'Kustuta fail'}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {hasMicrosoft && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-amber-900 mb-3">Pilves salvestatud failid (OneDrive)</h2>
            {oneDriveLoading && (
              <div className="flex items-center gap-2 text-amber-700 py-8">
                <Loader2 className="w-5 h-5 animate-spin" /> Laen töid…
              </div>
            )}
            {oneDriveError && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 p-4 mb-4">
                {oneDriveError}
              </div>
            )}
            {!oneDriveLoading && !oneDriveError && oneDriveFiles.length === 0 && (
              <p className="text-amber-700/90 py-6">OneDrive’is pole veel ühtegi NoodiMeister-faili. Kasuta tööriistas „Pilve salvesta“, et salvestada töid OneDrive’i.</p>
            )}
            {!oneDriveLoading && oneDriveFiles.length > 0 && (
              <ul className="space-y-2">
                {oneDriveFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <a
                      href={`${basePath}/app?fileId=${encodeURIComponent(f.id)}&cloud=onedrive`}
                      className="flex-1 min-w-0 text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-white/20 shadow-sm hover:bg-amber-50 dark:hover:bg-white/10 hover:border-amber-300 dark:hover:border-white/30 transition-colors no-underline text-inherit text-amber-900 dark:text-white"
                    >
                      <img src="/logo.png" alt="" className="h-8 w-8 flex-shrink-0 object-contain" aria-hidden />
                      <span className="font-medium text-amber-900 truncate flex-1">{f.name}</span>
                      <span className="text-sm text-amber-600 flex-shrink-0">{formatOneDriveDate(f)}</span>
                    </a>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); handleDeleteOneDriveFile(f.id, f.name); }}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-200 transition-colors"
                      title={t['file.delete'] || 'Kustuta fail'}
                      aria-label={t['file.delete'] || 'Kustuta fail'}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
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
