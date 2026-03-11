import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { User, Cloud, HardDrive, LogIn, FolderOpen, FolderPlus, Loader2, X, ChevronRight, Settings, ChevronDown, Trash2 } from 'lucide-react';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, LOCALES, getTranslations } from '../i18n';
import { useNoodimeisterOptional } from '../store/NoodimeisterContext';
import {
  getLoggedInUser,
  getStoredTokenFromAuth,
  getStoredMicrosoftTokenFromAuth,
  getGoogleSaveFolderId,
  setGoogleSaveFolderId,
  clearGoogleSaveFolder,
  getOneDriveSaveFolderId,
  setOneDriveSaveFolderId,
  clearOneDriveSaveFolder,
} from '../services/authStorage';
import * as googleDrive from '../services/googleDrive';
import {
  getOneDriveProfile,
  listNoodimeisterFilesFromOneDrive,
  listFolderChildren,
  createFolder as oneDriveCreateFolder,
  getItemName as oneDriveGetItemName,
  deleteFile as oneDriveDeleteFile,
} from '../services/oneDrive';

export default function AccountPage() {
  const [user, setUser] = useState(null);
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

  const setLocale = (code) => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, code);
      setLocaleState(code);
    } catch (_) {}
  };

  const [googleToken, setGoogleToken] = useState(null);
  const [microsoftToken, setMicrosoftToken] = useState(null);
  const [oneDriveProfile, setOneDriveProfile] = useState({ state: 'idle', data: null, error: null });
  const [oneDriveFiles, setOneDriveFiles] = useState({ state: 'idle', data: [], error: null });

  const [googleSaveFolderId, setGoogleSaveFolderIdState] = useState(null);
  const [googleSaveFolderName, setGoogleSaveFolderName] = useState('');
  const [oneDriveSaveFolderId, setOneDriveSaveFolderIdState] = useState(null);
  const [oneDriveSaveFolderName, setOneDriveSaveFolderName] = useState('');

  const [oneDrivePickerOpen, setOneDrivePickerOpen] = useState(false);
  const [oneDrivePickerPath, setOneDrivePickerPath] = useState([]);
  const [oneDrivePickerFolders, setOneDrivePickerFolders] = useState([]);
  const [oneDrivePickerLoading, setOneDrivePickerLoading] = useState(false);
  const [oneDriveCreateName, setOneDriveCreateName] = useState('NoodiMeister');
  const [oneDriveCreateLoading, setOneDriveCreateLoading] = useState(false);
  const [googleCreateName, setGoogleCreateName] = useState('NoodiMeister');
  const [googleCreateLoading, setGoogleCreateLoading] = useState(false);

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
      setUser(getLoggedInUser());
    } catch {
      setUser(null);
    }
    try {
      setGoogleToken(getStoredTokenFromAuth());
    } catch {
      setGoogleToken(null);
    }
    try {
      setMicrosoftToken(getStoredMicrosoftTokenFromAuth());
    } catch {
      setMicrosoftToken(null);
    }
    setGoogleSaveFolderIdState(getGoogleSaveFolderId());
    setOneDriveSaveFolderIdState(getOneDriveSaveFolderId());
  }, []);

  useEffect(() => {
    if (!googleToken || !googleSaveFolderId) {
      setGoogleSaveFolderName('');
      return;
    }
    let cancelled = false;
    googleDrive.getFolderMetadata(googleToken, googleSaveFolderId).then((meta) => {
      if (!cancelled && meta) setGoogleSaveFolderName(meta.name || '');
    });
    return () => { cancelled = true; };
  }, [googleToken, googleSaveFolderId]);

  useEffect(() => {
    if (!microsoftToken || !oneDriveSaveFolderId) {
      setOneDriveSaveFolderName('');
      return;
    }
    let cancelled = false;
    oneDriveGetItemName(microsoftToken, oneDriveSaveFolderId).then((name) => {
      if (!cancelled && name) setOneDriveSaveFolderName(name);
    });
    return () => { cancelled = true; };
  }, [microsoftToken, oneDriveSaveFolderId]);

  useEffect(() => {
    if (!microsoftToken) {
      setOneDriveProfile({ state: 'idle', data: null, error: null });
      setOneDriveFiles({ state: 'idle', data: [], error: null });
      return;
    }
    let cancelled = false;
    const folderId = getOneDriveSaveFolderId();
    (async () => {
      setOneDriveProfile({ state: 'loading', data: null, error: null });
      const profile = await getOneDriveProfile(microsoftToken);
      if (cancelled) return;
      if (!profile.ok) {
        setOneDriveProfile({ state: 'error', data: null, error: profile.error });
      } else {
        setOneDriveProfile({ state: 'success', data: profile, error: null });
      }

      setOneDriveFiles({ state: 'loading', data: [], error: null });
      const files = await listNoodimeisterFilesFromOneDrive(microsoftToken, folderId || undefined);
      if (cancelled) return;
      if (!files.ok) {
        setOneDriveFiles({ state: 'error', data: [], error: files.error });
      } else {
        setOneDriveFiles({ state: 'success', data: files.files, error: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [microsoftToken, oneDriveSaveFolderId]);

  const loadOneDrivePickerFolders = useCallback(async (parentId) => {
    if (!microsoftToken) return;
    setOneDrivePickerLoading(true);
    const result = await listFolderChildren(microsoftToken, parentId);
    setOneDrivePickerLoading(false);
    if (result.ok) setOneDrivePickerFolders(result.folders || []);
    else setOneDrivePickerFolders([]);
  }, [microsoftToken]);

  const loadOneDriveFiles = useCallback(async () => {
    if (!microsoftToken) return;
    const folderId = getOneDriveSaveFolderId();
    setOneDriveFiles((prev) => ({ ...prev, state: 'loading', data: [], error: null }));
    const result = await listNoodimeisterFilesFromOneDrive(microsoftToken, folderId || undefined);
    if (result.ok) {
      setOneDriveFiles({ state: 'success', data: result.files || [], error: null });
    } else {
      setOneDriveFiles({ state: 'error', data: [], error: result.error || null });
    }
  }, [microsoftToken]);

  const handleDeleteOneDriveFile = useCallback(async (fileId, fileName) => {
    const msg = (t['file.deleteConfirm'] || 'Kas kustutame faili "{name}"? Seda ei saa tagasi võtta.').replace('{name}', fileName || '');
    if (!window.confirm(msg)) return;
    if (!microsoftToken) return;
    try {
      await oneDriveDeleteFile(microsoftToken, fileId);
      await loadOneDriveFiles();
    } catch (e) {
      setOneDriveFiles((prev) => ({ ...prev, state: 'error', error: e?.message || 'Kustutamine ebaõnnestus' }));
    }
  }, [microsoftToken, loadOneDriveFiles, t]);

  useEffect(() => {
    if (oneDrivePickerOpen && microsoftToken) {
      const currentId = oneDrivePickerPath.length ? oneDrivePickerPath[oneDrivePickerPath.length - 1].id : null;
      loadOneDrivePickerFolders(currentId);
    }
  }, [oneDrivePickerOpen, microsoftToken, oneDrivePickerPath.length, oneDrivePickerPath[oneDrivePickerPath.length - 1]?.id]);

  const handleGooglePickFolder = async () => {
    if (!googleToken) return;
    const folderId = await googleDrive.pickFolder(googleToken);
    if (folderId) {
      setGoogleSaveFolderId(folderId);
      setGoogleSaveFolderIdState(folderId);
    }
  };

  const handleGoogleCreateFolder = async () => {
    if (!googleToken) return;
    const name = (googleCreateName || 'NoodiMeister').trim();
    if (!name) return;
    setGoogleCreateLoading(true);
    try {
      const folderId = await googleDrive.createFolder(googleToken, 'root', name);
      setGoogleSaveFolderId(folderId);
      setGoogleSaveFolderIdState(folderId);
      setGoogleSaveFolderName(name);
    } catch (e) {
      console.error(e);
    } finally {
      setGoogleCreateLoading(false);
    }
  };

  const handleOneDriveSelectFolder = (folderId) => {
    oneDriveGetItemName(microsoftToken, folderId).then((name) => {
      setOneDriveSaveFolderId(folderId);
      setOneDriveSaveFolderIdState(folderId);
      setOneDriveSaveFolderName(name || '');
    });
    setOneDrivePickerOpen(false);
    setOneDrivePickerPath([]);
  };

  const handleOneDriveCreateFolder = async () => {
    if (!microsoftToken) return;
    const name = (oneDriveCreateName || 'NoodiMeister').trim();
    if (!name) return;
    setOneDriveCreateLoading(true);
    try {
      const result = await oneDriveCreateFolder(microsoftToken, oneDriveSaveFolderId || 'root', name);
      if (result.ok && result.id) {
        setOneDriveSaveFolderId(result.id);
        setOneDriveSaveFolderIdState(result.id);
        setOneDriveSaveFolderName(result.name || name);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setOneDriveCreateLoading(false);
    }
  };

  const providerLabel =
    user?.provider === 'google'
      ? 'Google'
      : user?.provider === 'microsoft'
      ? 'Microsoft (OneDrive)'
      : 'E-mail / muu';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      <header className="flex-shrink-0 border-b border-amber-200/60 dark:border-white/20 bg-white/70 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="NoodiMeister" className="h-9 w-auto" />
          </Link>
          <nav className="flex items-center gap-3 flex-wrap" ref={settingsRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm bg-amber-100/80 dark:bg-white/10 text-amber-900 dark:text-white border border-amber-200 dark:border-white/20 hover:bg-amber-200/80 dark:hover:bg-white/20 transition-colors"
                title={t['settings.title']}
                aria-expanded={settingsOpen}
              >
                <Settings className="w-4 h-4" />
                <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-1 min-w-[200px] py-2 rounded-xl bg-white dark:bg-zinc-900 border-2 border-amber-200 dark:border-white/20 shadow-xl z-50">
                  <div className="px-3 py-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wider">{t['app.language']}</div>
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
                  <div className="px-3 py-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wider">{t['app.theme']}</div>
                  <div className="flex gap-1 px-2">
                    <button
                      type="button"
                      onClick={() => { setThemeMode('light'); setSettingsOpen(false); }}
                      className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${themeMode === 'light' ? 'bg-amber-500 text-white' : 'text-amber-800 hover:bg-amber-100'}`}
                    >
                      {t['theme.light']}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setThemeMode('dark'); setSettingsOpen(false); }}
                      className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${themeMode === 'dark' ? 'bg-amber-500 text-white' : 'text-amber-800 hover:bg-amber-100'}`}
                    >
                      {t['theme.dark']}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <Link to="/tood" className="text-amber-700 dark:text-white hover:text-amber-900 dark:hover:text-white/90 font-medium">
              {t['account.myWork']}
            </Link>
            <Link to="/" className="text-amber-700 dark:text-white hover:text-amber-900 dark:hover:text-white/90 font-medium">
              {t['account.home']}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border-2 border-amber-200 dark:border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-8 py-6 flex items-center gap-3">
            <User className="w-6 h-6 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>
                {t['user.myAccount']}
              </h1>
              {user ? (
                <p className="text-slate-200 text-lg mt-1 font-medium truncate" title={user.email}>
                  {user.name || user.email || '—'}
                </p>
              ) : null}
              <p className="text-slate-200 text-sm mt-1">
                {t['account.subtitle']}
              </p>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/tood"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors shadow-sm"
              >
                <FolderOpen className="w-5 h-5" />
                {t['account.myWork']}
              </Link>
            </div>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-700" /> {t['account.user']}
              </h2>
              {user ? (
                <div className="text-sm text-amber-800 space-y-1">
                  <p>
                    <span className="font-semibold">{t['account.email']}:</span> {user.email}
                  </p>
                  <p>
                    <span className="font-semibold">{t['account.name']}:</span> {user.name || '—'}
                  </p>
                  <p>
                    <span className="font-semibold">{t['account.loginMethod']}:</span> {providerLabel}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-amber-800 flex items-center gap-2">
                  <LogIn className="w-4 h-4" /> {t['account.notLoggedIn']}{' '}
                  <Link to="/login" className="underline font-medium text-amber-800 hover:text-amber-900">
                    {t['account.logIn']}
                  </Link>
                  .
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-amber-700" /> Kohalik fail
              </h2>
              <p className="text-sm text-amber-800">
                NoodiMeister saab alati salvestada faili sinu arvutisse (ilma kontota). See töötab sõltumata Google'ist või Microsoftist.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-sky-600" /> Google Drive
              </h2>
              {googleToken ? (
                <>
                  <p className="text-sm text-amber-800">
                    Oled andnud loa Google Drive'i jaoks. Minu tööde vaates saad näha ja avada oma Google Drive'i NoodiMeisteri faile.
                  </p>
                  <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/70 space-y-3">
                    <p className="text-sm font-semibold text-amber-900">Salvestuskaust</p>
                    <p className="text-sm text-amber-800">
                      {googleSaveFolderId
                        ? `Praegu: ${googleSaveFolderName || googleSaveFolderId}`
                        : 'Salvestuskaust pole valitud – tööriistas valitakse iga kord (või vali siin).'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleGooglePickFolder}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-sky-300 bg-sky-50 text-sky-800 font-medium hover:bg-sky-100 text-sm"
                      >
                        <FolderOpen className="w-4 h-4" /> Vali salvestuskaust
                      </button>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={googleCreateName}
                          onChange={(e) => setGoogleCreateName(e.target.value)}
                          placeholder="Kausta nimi"
                          className="w-36 px-2 py-1.5 rounded border border-amber-200 text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleGoogleCreateFolder}
                          disabled={googleCreateLoading}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-60 text-sm"
                        >
                          {googleCreateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                          Loo uus kaust
                        </button>
                      </div>
                      {googleSaveFolderId && (
                        <button
                          type="button"
                          onClick={() => {
                            clearGoogleSaveFolder();
                            setGoogleSaveFolderIdState(null);
                            setGoogleSaveFolderName('');
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-white text-amber-800 font-medium hover:bg-amber-50 text-sm"
                        >
                          <X className="w-4 h-4" /> Eemalda salvestuskaust
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-amber-800">
                  Google Drive'i pole veel ühendatud. Logi sisse Google'i nupuga, et salvestada ja laadida faile Google Drive'i.
                </p>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-700" /> OneDrive (Microsoft)
              </h2>
              {!microsoftToken && (
                <p className="text-sm text-amber-800">
                  Microsofti konto pole veel ühendatud. Logi sisse Microsofti nupuga (login/registreeru), et lubada OneDrive'i kasutamine.
                </p>
              )}
              {microsoftToken && (
                <div className="space-y-3 text-sm text-amber-800">
                  {oneDriveProfile.state === 'loading' && <p>Laen Microsofti profiili…</p>}
                  {oneDriveProfile.state === 'error' && (
                    <p className="text-red-700">
                      Profiili lugemine ebaõnnestus: {oneDriveProfile.error}
                    </p>
                  )}
                  {oneDriveProfile.state === 'success' && oneDriveProfile.data && (
                    <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/70">
                      <p>
                        <span className="font-semibold">OneDrive'i konto:</span>{' '}
                        {oneDriveProfile.data.displayName || oneDriveProfile.data.mail || '—'}
                      </p>
                    </div>
                  )}

                  <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/70 space-y-3">
                    <p className="text-sm font-semibold text-amber-900">Salvestuskaust</p>
                    <p className="text-sm text-amber-800">
                      {oneDriveSaveFolderId
                        ? `Praegu: ${oneDriveSaveFolderName || oneDriveSaveFolderId}`
                        : 'Salvestuskaust pole valitud – failid salvestatakse OneDrive\'i juurkausta.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOneDrivePickerPath([]);
                          setOneDrivePickerOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-blue-300 bg-blue-50 text-blue-800 font-medium hover:bg-blue-100 text-sm"
                      >
                        <FolderOpen className="w-4 h-4" /> Vali salvestuskaust
                      </button>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={oneDriveCreateName}
                          onChange={(e) => setOneDriveCreateName(e.target.value)}
                          placeholder="Kausta nimi"
                          className="w-36 px-2 py-1.5 rounded border border-amber-200 text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleOneDriveCreateFolder}
                          disabled={oneDriveCreateLoading}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 text-sm"
                        >
                          {oneDriveCreateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                          Loo uus kaust
                        </button>
                      </div>
                      {oneDriveSaveFolderId && (
                        <button
                          type="button"
                          onClick={() => {
                            clearOneDriveSaveFolder();
                            setOneDriveSaveFolderIdState(null);
                            setOneDriveSaveFolderName('');
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-white text-amber-800 font-medium hover:bg-amber-50 text-sm"
                        >
                          <X className="w-4 h-4" /> Eemalda salvestuskaust
                        </button>
                      )}
                    </div>
                  </div>

                  {oneDriveFiles.state === 'loading' && <p>Laen OneDrive'i NoodiMeisteri faile…</p>}
                  {oneDriveFiles.state === 'error' && (
                    <p className="text-red-700">
                      OneDrive'i failide lugemine ebaõnnestus: {oneDriveFiles.error}
                    </p>
                  )}
                  {oneDriveFiles.state === 'success' && (
                    <>
                      {oneDriveFiles.data.length === 0 ? (
                        <p className="text-sm text-amber-800">
                          Valitud kaustas ei leitud veel ühtegi NoodiMeisteri faili. Salvesta tööriistast pilve, et siia failid ilmuda.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-semibold text-amber-900">NoodiMeisteri failid OneDrive'is:</p>
                          <ul className="max-h-40 overflow-y-auto text-sm space-y-2">
                            {oneDriveFiles.data.map((f) => (
                              <li key={f.id} className="flex items-center gap-2">
                                <img src="/logo.png" alt="" className="h-6 w-6 flex-shrink-0 object-contain" aria-hidden />
                                <span className="truncate flex-1">{f.name}</span>
                                {f.webUrl && (
                                  <a
                                    href={f.webUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sky-700 underline flex-shrink-0"
                                  >
                                    Ava OneDrive'is
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOneDriveFile(f.id, f.name)}
                                  className="p-1.5 rounded text-red-600 hover:bg-red-50 hover:text-red-700 flex-shrink-0"
                                  title={t['file.delete'] || 'Kustuta fail'}
                                  aria-label={t['file.delete'] || 'Kustuta fail'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {oneDrivePickerOpen && microsoftToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOneDrivePickerOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl border-2 border-amber-200 max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-amber-200 flex items-center justify-between">
              <h3 className="font-semibold text-amber-900">Vali OneDrive'i kaust</h3>
              <button type="button" onClick={() => setOneDrivePickerOpen(false)} className="p-1 rounded hover:bg-amber-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-1 px-4 py-2 bg-amber-50 border-b border-amber-100 text-sm">
              <button
                type="button"
                onClick={() => setOneDrivePickerPath([])}
                className="text-amber-700 hover:underline"
              >
                Juurkaust
              </button>
              {oneDrivePickerPath.map((p, i) => (
                <React.Fragment key={p.id}>
                  <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <button
                    type="button"
                    onClick={() => setOneDrivePickerPath(oneDrivePickerPath.slice(0, i + 1))}
                    className="text-amber-700 hover:underline truncate max-w-[120px]"
                  >
                    {p.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {oneDrivePickerLoading ? (
                <div className="flex items-center gap-2 text-amber-700 py-4">
                  <Loader2 className="w-5 h-5 animate-spin" /> Laen kaustu…
                </div>
              ) : (
                <ul className="space-y-1">
                  {oneDrivePickerPath.length > 0 && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setOneDrivePickerPath((prev) => prev.slice(0, -1))}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-100 text-amber-900"
                      >
                        <span className="font-medium">..</span> Ülemine kaust
                      </button>
                    </li>
                  )}
                  {oneDrivePickerFolders.map((f) => (
                    <li key={f.id}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOneDrivePickerPath((prev) => [...prev, { id: f.id, name: f.name }])}
                          className="flex-1 text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-100 text-amber-900"
                        >
                          <FolderOpen className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOneDriveSelectFolder(f.id)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                        >
                          Vali
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

