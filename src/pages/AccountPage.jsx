import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Cloud, HardDrive, LogIn, LogOut, FolderOpen, FolderPlus, FilePlus, Loader2, X, ChevronRight, Settings, ChevronDown, Trash2, Pencil } from 'lucide-react';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, LOCALES, getTranslations } from '../i18n';
import { useNoodimeisterOptional } from '../store/NoodimeisterContext';
import {
  getLoggedInUser,
  getStoredTokenFromAuth,
  getStoredMicrosoftTokenFromAuth,
  getGoogleSaveFolderId,
  getGoogleSaveFolders,
  setGoogleSaveFolderId,
  setGoogleSaveFoldersForCurrentUser,
  clearGoogleSaveFolder,
  updateGoogleSaveFolderName,
  getOneDriveSaveFolderId,
  getOneDriveSaveFolders,
  setOneDriveSaveFolderId,
  setOneDriveSaveFoldersForCurrentUser,
  clearOneDriveSaveFolder,
  updateOneDriveSaveFolderName,
  clearAuth,
} from '../services/authStorage';
import * as googleDrive from '../services/googleDrive';
import {
  getOneDriveProfile,
  listNoodimeisterFilesFromOneDrive,
  listFolderChildren,
  createFolder as oneDriveCreateFolder,
  getItemName as oneDriveGetItemName,
  deleteFile as oneDriveDeleteFile,
  renameItem as oneDriveRenameItem,
  getSaveFoldersConfig as oneDriveGetSaveFoldersConfig,
  setSaveFoldersConfig as oneDriveSetSaveFoldersConfig,
} from '../services/oneDrive';
import { AppLogo } from '../components/AppLogo';

export default function AccountPage() {
  const navigate = useNavigate();
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

  // Ensure theme is applied to document when Account page mounts (e.g. direct nav to /konto)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('noodimeister-theme');
      if (raw) {
        const o = JSON.parse(raw);
        const mode = o.mode === 'dark' ? 'dark' : 'light';
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.setAttribute('data-theme', mode);
        }
      }
    } catch (_) {}
  }, []);

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
  const [googleFiles, setGoogleFiles] = useState({ state: 'idle', data: [], error: null });

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
  const [renameFolderOpen, setRenameFolderOpen] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [renameFolderLoading, setRenameFolderLoading] = useState(false);
  const [renameFolderError, setRenameFolderError] = useState(null);

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
    if (!googleToken && !microsoftToken) return;
    let cancelled = false;
    (async () => {
      if (googleToken) {
        try {
          const cloud = await googleDrive.getSaveFoldersConfig(googleToken);
          if (!cancelled && cloud.length > 0) {
            setGoogleSaveFoldersForCurrentUser(cloud);
            setGoogleSaveFolderIdState(getGoogleSaveFolderId());
          }
        } catch (_) {}
      }
      if (microsoftToken) {
        try {
          const cloud = await oneDriveGetSaveFoldersConfig(microsoftToken);
          if (!cancelled && cloud.length > 0) {
            setOneDriveSaveFoldersForCurrentUser(cloud);
            setOneDriveSaveFolderIdState(getOneDriveSaveFolderId());
          }
        } catch (_) {}
      }
    })();
    return () => { cancelled = true; };
  }, [googleToken, microsoftToken]);

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

  useEffect(() => {
    if (!googleToken) {
      setGoogleFiles({ state: 'idle', data: [], error: null });
      return;
    }
    let cancelled = false;
    const folderId = getGoogleSaveFolderId();
    setGoogleFiles((prev) => ({ ...prev, state: 'loading', data: prev.data || [], error: null }));
    googleDrive.listNoodimeisterFiles(googleToken, folderId ? { folderId } : {}).then((list) => {
      if (!cancelled) setGoogleFiles({ state: 'success', data: list || [], error: null });
    }).catch((e) => {
      if (!cancelled) setGoogleFiles({ state: 'error', data: [], error: e?.message || (t['account.loadError'] || 'Laadimine ebaõnnestus') });
    });
    return () => { cancelled = true; };
  }, [googleToken, googleSaveFolderId]);

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
      setOneDriveFiles((prev) => ({ ...prev, state: 'error', error: e?.message || (t['account.deleteError'] || 'Kustutamine ebaõnnestus') }));
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
      const meta = await googleDrive.getFolderMetadata(googleToken, folderId).catch(() => null);
      const name = meta?.name || '';
      setGoogleSaveFolderId(folderId, name);
      setGoogleSaveFolderIdState(folderId);
      setGoogleSaveFolderName(name);
      try { await googleDrive.setSaveFoldersConfig(googleToken, getGoogleSaveFolders()); } catch (_) {}
    }
  };

  const handleGoogleCreateFolder = async () => {
    if (!googleToken) return;
    const name = (googleCreateName || 'NoodiMeister').trim();
    if (!name) return;
    setGoogleCreateLoading(true);
    try {
      const folderId = await googleDrive.createFolder(googleToken, 'root', name);
      setGoogleSaveFolderId(folderId, name);
      setGoogleSaveFolderIdState(folderId);
      setGoogleSaveFolderName(name);
      try { await googleDrive.setSaveFoldersConfig(googleToken, getGoogleSaveFolders()); } catch (_) {}
    } catch (e) {
      console.error(e);
    } finally {
      setGoogleCreateLoading(false);
    }
  };

  const handleOneDriveSelectFolder = (folderId) => {
    oneDriveGetItemName(microsoftToken, folderId).then((name) => {
      setOneDriveSaveFolderId(folderId, name || '');
      setOneDriveSaveFolderIdState(folderId);
      setOneDriveSaveFolderName(name || '');
      oneDriveSetSaveFoldersConfig(microsoftToken, getOneDriveSaveFolders()).catch(() => {});
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
        setOneDriveSaveFolderId(result.id, result.name || name);
        setOneDriveSaveFolderIdState(result.id);
        setOneDriveSaveFolderName(result.name || name);
        try { await oneDriveSetSaveFoldersConfig(microsoftToken, getOneDriveSaveFolders()); } catch (_) {}
      }
    } catch (e) {
      console.error(e);
    } finally {
      setOneDriveCreateLoading(false);
    }
  };

  const handleRenameFolder = useCallback(async () => {
    if (!renameFolderOpen || !renameFolderName.trim()) return;
    const { provider } = renameFolderOpen;
    setRenameFolderError(null);
    setRenameFolderLoading(true);
    try {
      if (provider === 'google' && googleToken && googleSaveFolderId) {
        await googleDrive.renameFolder(googleToken, googleSaveFolderId, renameFolderName.trim());
        updateGoogleSaveFolderName(googleSaveFolderId, renameFolderName.trim());
        setGoogleSaveFolderName(renameFolderName.trim());
        setRenameFolderOpen(null);
        setRenameFolderName('');
      } else if (provider === 'onedrive' && microsoftToken && oneDriveSaveFolderId) {
        const result = await oneDriveRenameItem(microsoftToken, oneDriveSaveFolderId, renameFolderName.trim());
        if (result.ok) {
          updateOneDriveSaveFolderName(oneDriveSaveFolderId, result.name || renameFolderName.trim());
          setOneDriveSaveFolderName(result.name || renameFolderName.trim());
          setRenameFolderOpen(null);
          setRenameFolderName('');
        } else {
          setRenameFolderError(result.error || (t['account.createFolderError'] || 'Ümbernimetamine ebaõnnestus'));
        }
      }
    } catch (e) {
      setRenameFolderError(e?.message || (t['account.createFolderError'] || 'Ümbernimetamine ebaõnnestus'));
    } finally {
      setRenameFolderLoading(false);
    }
  }, [renameFolderOpen, renameFolderName, googleToken, googleSaveFolderId, microsoftToken, oneDriveSaveFolderId, t]);

  const providerLabel =
    user?.provider === 'google'
      ? 'Google'
      : user?.provider === 'microsoft'
      ? 'Microsoft (OneDrive)'
      : (t['account.providerEmailOther'] || 'E-mail / muu');

  const basePath = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL)?.replace(/\/$/, '') || '';
  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'et-EE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const handleLogout = () => {
    clearAuth();
    setSettingsOpen(false);
    // Full page navigation so all auth state (including Microsoft/MSAL) is cleared and app reinitializes
    try {
      const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL)?.replace(/\/$/, '') || '';
      window.location.replace(window.location.origin + base + '/');
    } catch {
      window.location.replace('/');
    }
  };

  return (
    <div className="account-page min-h-screen flex flex-col">
      <header className="flex-shrink-0 border-b border-amber-200/60 dark:border-white/20 bg-white/70 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <AppLogo variant="header" alt="NoodiMeister" />
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
                <div className="account-settings-dropdown absolute right-0 top-full mt-1 min-w-[200px] py-2 rounded-xl bg-white dark:bg-zinc-900 border-2 border-amber-200 dark:border-white/20 shadow-xl z-50">
                  <div className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-white/80 uppercase tracking-wider">{t['app.language']}</div>
                  <div className="flex gap-0.5 px-2 pb-2">
                    {LOCALES.map(({ code, name }) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => { setLocale(code); setSettingsOpen(false); }}
                        className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${locale === code ? 'bg-amber-500 text-white' : 'text-amber-800 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10'}`}
                        title={name}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-amber-200 dark:border-white/20 my-1" />
                  <div className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-white/80 uppercase tracking-wider">{t['app.theme']}</div>
                  <div className="flex gap-1 px-2">
                    <button
                      type="button"
                      onClick={() => { setThemeMode('light'); setSettingsOpen(false); }}
                      className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${themeMode === 'light' ? 'bg-amber-500 text-white' : 'text-amber-800 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10'}`}
                    >
                      {t['theme.light']}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setThemeMode('dark'); setSettingsOpen(false); }}
                      className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${themeMode === 'dark' ? 'bg-amber-500 text-white' : 'text-amber-800 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10'}`}
                    >
                      {t['theme.dark']}
                    </button>
                  </div>
                  <div className="border-t border-amber-200 dark:border-white/20 my-1" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    title={t['user.logoutTitle'] || 'Logi välja'}
                  >
                    <LogOut className="w-4 h-4" /> {t['user.logout'] || 'Logi välja'}
                  </button>
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
        <div className="account-card w-full max-w-2xl bg-white dark:bg-black rounded-2xl shadow-xl border-2 border-amber-200 dark:border-white/20 overflow-hidden">
          <div className="account-card-header bg-gradient-to-r from-slate-700 to-slate-800 text-white px-8 py-6 flex items-center gap-3">
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

          <div className="account-card-inner p-8 space-y-6 dark:text-white">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={`${basePath}/app?new=1`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold hover:from-amber-500 hover:to-orange-500 transition-colors shadow-sm no-underline"
              >
                <FilePlus className="w-5 h-5" />
                {t['account.newWork']}
              </a>
              <Link
                to="/tood"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-amber-300 dark:border-white/30 bg-amber-50 dark:bg-white/10 text-amber-800 dark:text-white font-semibold hover:bg-amber-100 dark:hover:bg-white/20 transition-colors"
              >
                <FolderOpen className="w-5 h-5" />
                {t['account.myWork']}
              </Link>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-amber-900 dark:text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-amber-700 dark:text-white/80" /> {t['account.myWork']}
              </h2>
              <p className="text-sm text-amber-800 dark:text-white/90">
                {t['account.myWorkFilesHint']}
              </p>
              {googleToken && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-white">{t['account.googleDriveSection']}</h3>
                  {googleFiles.state === 'loading' && (
                    <div className="flex items-center gap-2 text-amber-700 dark:text-white/80 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> {t['account.loading']}
                    </div>
                  )}
                  {googleFiles.state === 'error' && (
                    <p className="text-sm text-red-700 dark:text-red-400">{googleFiles.error}</p>
                  )}
                  {googleFiles.state === 'success' && googleFiles.data.length === 0 && (
                    <p className="text-sm text-amber-800 dark:text-white/80">{t['account.noFilesInCloud']}</p>
                  )}
                  {googleFiles.state === 'success' && googleFiles.data.length > 0 && (
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                      {googleFiles.data.map((f) => (
                        <li key={f.id}>
                          <a
                            href={`${basePath}/app?fileId=${encodeURIComponent(f.id)}`}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50/70 dark:bg-white/10 border border-amber-200/60 dark:border-white/20 hover:bg-amber-100/80 dark:hover:bg-white/20 no-underline text-inherit"
                          >
                            <AppLogo variant="iconSm" alt="" />
                            <span className="truncate flex-1 text-sm font-medium">{f.name}</span>
                            <span className="text-xs text-amber-600 dark:text-white/70 flex-shrink-0">{formatDate(f.modifiedTime)}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {microsoftToken && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-white">{t['account.oneDriveSection']}</h3>
                  {oneDriveFiles.state === 'loading' && (
                    <div className="flex items-center gap-2 text-amber-700 dark:text-white/80 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> {t['account.loading']}
                    </div>
                  )}
                  {oneDriveFiles.state === 'error' && (
                    <p className="text-sm text-red-700 dark:text-red-400">{oneDriveFiles.error}</p>
                  )}
                  {oneDriveFiles.state === 'success' && oneDriveFiles.data.length === 0 && (
                    <p className="text-sm text-amber-800 dark:text-white/80">{t['account.noFilesOneDrive']}</p>
                  )}
                  {oneDriveFiles.state === 'success' && oneDriveFiles.data.length > 0 && (
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                      {oneDriveFiles.data.map((f) => (
                        <li key={f.id}>
                          <a
                            href={`${basePath}/app?fileId=${encodeURIComponent(f.id)}&cloud=onedrive`}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50/70 dark:bg-white/10 border border-amber-200/60 dark:border-white/20 hover:bg-amber-100/80 dark:hover:bg-white/20 no-underline text-inherit"
                          >
                            <AppLogo variant="iconSm" alt="" />
                            <span className="truncate flex-1 text-sm font-medium">{f.name}</span>
                            <span className="text-xs text-amber-600 dark:text-white/70 flex-shrink-0">{formatDate(f.lastModifiedDateTime)}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {!googleToken && !microsoftToken && (
                <p className="text-sm text-amber-800 dark:text-white/80">
                  {t['account.noCloudFiles']}
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-900 dark:text-white flex items-center gap-2">
                <User className="w-5 h-5 text-amber-700 dark:text-white/80" /> {t['account.user']}
              </h2>
              {user ? (
                <div className="text-sm text-amber-800 dark:text-white/90 space-y-1">
                  <p>
                    <span className="font-semibold">{t['account.email']}:</span> {user.email}
                  </p>
                  <p>
                    <span className="font-semibold">{t['account.name']}:</span> {user.name || '—'}
                  </p>
                  <p>
                    <span className="font-semibold">{t['account.loginMethod']}:</span> {providerLabel}
                  </p>
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      title={t['user.logoutTitle'] || 'Logi välja'}
                    >
                      <LogOut className="w-4 h-4" /> {t['user.logout'] || 'Logi välja'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-800 dark:text-white/90 flex items-center gap-2">
                  <LogIn className="w-4 h-4" /> {t['account.notLoggedIn']}{' '}
                  <Link to="/login" className="underline font-medium text-amber-800 dark:text-white hover:text-amber-900 dark:hover:text-white/90">
                    {t['account.logIn']}
                  </Link>
                  .
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-900 dark:text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-amber-700 dark:text-white/80" /> {t['account.localFile']}
              </h2>
              <p className="text-sm text-amber-800 dark:text-white/90">
                {t['account.localFileHint']}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-amber-900 dark:text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-sky-600 dark:text-white/80" /> {t['account.googleDriveSection']}
              </h2>
              {googleToken ? (
                <>
                  <p className="text-sm text-amber-800 dark:text-white/90">
                    {t['account.googleConnectedHint']}
                  </p>
                  <div className="border border-amber-200 dark:border-white/20 rounded-xl p-4 bg-amber-50/70 dark:bg-white/10 space-y-3">
                    <p className="text-sm font-semibold text-amber-900 dark:text-white">{t['account.saveFolder']}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-amber-800 dark:text-white/90">
                        {googleSaveFolderId
                          ? (t['account.saveFolderCurrent'] || 'Praegu: {{name}}').replace('{{name}}', googleSaveFolderName || googleSaveFolderId)
                          : t['account.saveFolderNotSelected']}
                      </p>
                      {googleSaveFolderId && (
                        <button
                          type="button"
                          onClick={() => { setRenameFolderOpen({ provider: 'google' }); setRenameFolderName(googleSaveFolderName || ''); setRenameFolderError(null); }}
                          className="p-1.5 rounded-lg text-amber-700 dark:text-white/80 hover:bg-amber-100 dark:hover:bg-white/10 border border-amber-200/60 dark:border-white/20"
                          title={t['account.renameFolder'] || 'Muuda kausta nime'}
                          aria-label={t['account.renameFolder'] || 'Muuda kausta nime'}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleGooglePickFolder}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-sky-300 dark:border-white/30 bg-sky-50 dark:bg-white/10 text-sky-800 dark:text-white font-medium hover:bg-sky-100 dark:hover:bg-white/20 text-sm"
                      >
                        <FolderOpen className="w-4 h-4" /> {t['account.pickSaveFolder']}
                      </button>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={googleCreateName}
                          onChange={(e) => setGoogleCreateName(e.target.value)}
                          placeholder={t['account.folderNamePlaceholder']}
                          className="w-36 px-2 py-1.5 rounded border border-amber-200 dark:border-white/30 dark:bg-black/50 dark:text-white text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleGoogleCreateFolder}
                          disabled={googleCreateLoading}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-60 text-sm"
                        >
                          {googleCreateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                          {t['account.createNewFolder']}
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
className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 dark:border-white/30 bg-white dark:bg-white/10 text-amber-800 dark:text-white font-medium hover:bg-amber-50 dark:hover:bg-white/20 text-sm"
                        >
                        <X className="w-4 h-4" /> {t['account.removeSaveFolder']}
                      </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-amber-800 dark:text-white/90">
                  {t['account.googleNotConnected']}
                </p>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-amber-900 dark:text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-700 dark:text-white/80" /> {t['account.oneDriveSection']}
              </h2>
              {!microsoftToken && (
                <p className="text-sm text-amber-800 dark:text-white/90">
                  {t['account.oneDriveNotConnected']}
                </p>
              )}
              {microsoftToken && (
                <div className="space-y-3 text-sm text-amber-800 dark:text-white/90">
                  {oneDriveProfile.state === 'loading' && <p>{t['account.loadingProfile']}</p>}
                  {oneDriveProfile.state === 'error' && (
                    <p className="text-red-700 dark:text-red-400">
                      {t['account.profileError']}: {oneDriveProfile.error}
                    </p>
                  )}
                  {oneDriveProfile.state === 'success' && oneDriveProfile.data && (
                    <div className="border border-amber-200 dark:border-white/20 rounded-lg p-3 bg-amber-50/70 dark:bg-white/10">
                      <p>
                        <span className="font-semibold">{t['account.oneDriveAccount']}:</span>{' '}
                        {oneDriveProfile.data.displayName || oneDriveProfile.data.mail || '—'}
                      </p>
                    </div>
                  )}

                  <div className="border border-amber-200 dark:border-white/20 rounded-xl p-4 bg-amber-50/70 dark:bg-white/10 space-y-3">
                    <p className="text-sm font-semibold text-amber-900 dark:text-white">{t['account.saveFolder']}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-amber-800 dark:text-white/90">
                        {oneDriveSaveFolderId
                          ? (t['account.saveFolderCurrent'] || 'Praegu: {{name}}').replace('{{name}}', oneDriveSaveFolderName || oneDriveSaveFolderId)
                          : t['account.saveFolderNotSelectedOneDrive']}
                      </p>
                      {oneDriveSaveFolderId && (
                        <button
                          type="button"
                          onClick={() => { setRenameFolderOpen({ provider: 'onedrive' }); setRenameFolderName(oneDriveSaveFolderName || ''); setRenameFolderError(null); }}
                          className="p-1.5 rounded-lg text-amber-700 dark:text-white/80 hover:bg-amber-100 dark:hover:bg-white/10 border border-amber-200/60 dark:border-white/20"
                          title={t['account.renameFolder'] || 'Muuda kausta nime'}
                          aria-label={t['account.renameFolder'] || 'Muuda kausta nime'}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOneDrivePickerPath([]);
                          setOneDrivePickerOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-blue-300 dark:border-white/30 bg-blue-50 dark:bg-white/10 text-blue-800 dark:text-white font-medium hover:bg-blue-100 dark:hover:bg-white/20 text-sm"
                      >
                        <FolderOpen className="w-4 h-4" /> {t['account.pickSaveFolder']}
                      </button>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={oneDriveCreateName}
                          onChange={(e) => setOneDriveCreateName(e.target.value)}
                          placeholder={t['account.folderNamePlaceholder']}
                          className="w-36 px-2 py-1.5 rounded border border-amber-200 dark:border-white/30 dark:bg-black/50 dark:text-white text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleOneDriveCreateFolder}
                          disabled={oneDriveCreateLoading}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 text-sm"
                        >
                          {oneDriveCreateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                          {t['account.createNewFolder']}
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
className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 dark:border-white/30 bg-white dark:bg-white/10 text-amber-800 dark:text-white font-medium hover:bg-amber-50 dark:hover:bg-white/20 text-sm"
                        >
                        <X className="w-4 h-4" /> {t['account.removeSaveFolder']}
                        </button>
                      )}
                    </div>
                  </div>

                  {oneDriveFiles.state === 'loading' && <p>{t['account.loadingOneDriveFiles']}</p>}
                  {oneDriveFiles.state === 'error' && (
                    <p className="text-red-700 dark:text-red-400">
                      {t['account.oneDriveLoadError']}: {oneDriveFiles.error}
                    </p>
                  )}
                  {oneDriveFiles.state === 'success' && (
                    <>
                      {oneDriveFiles.data.length === 0 ? (
                        <p className="text-sm text-amber-800 dark:text-white/90">
                          {t['account.oneDriveEmptyHint']}
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-semibold text-amber-900 dark:text-white">{t['account.oneDriveFilesList']}:</p>
                          <ul className="max-h-40 overflow-y-auto text-sm space-y-2">
                            {oneDriveFiles.data.map((f) => (
                              <li key={f.id} className="flex items-center gap-2">
                                <AppLogo variant="iconSm" alt="" />
                                <span className="truncate flex-1">{f.name}</span>
                                {f.webUrl && (
                                  <a
                                    href={f.webUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sky-700 dark:text-white underline flex-shrink-0"
                                  >
                                    {t['account.openInOneDrive']}
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOneDriveFile(f.id, f.name)}
                                  className="p-1.5 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-700 dark:hover:text-red-300 flex-shrink-0"
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
          <div className="account-picker-modal bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border-2 border-amber-200 dark:border-white/20 max-w-md w-full max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-amber-200 dark:border-white/20 flex items-center justify-between">
              <h3 className="font-semibold text-amber-900 dark:text-white">{t['account.pickOneDriveFolder']}</h3>
              <button type="button" onClick={() => setOneDrivePickerOpen(false)} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-white/10 text-amber-900 dark:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-1 px-4 py-2 bg-amber-50 dark:bg-white/10 border-b border-amber-100 dark:border-white/20 text-sm">
              <button
                type="button"
                onClick={() => setOneDrivePickerPath([])}
                className="text-amber-700 dark:text-white hover:underline"
              >
                {t['account.rootFolder']}
              </button>
              {oneDrivePickerPath.map((p, i) => (
                <React.Fragment key={p.id}>
                  <ChevronRight className="w-4 h-4 text-amber-500 dark:text-white/70 flex-shrink-0" />
                  <button
                    type="button"
                    onClick={() => setOneDrivePickerPath(oneDrivePickerPath.slice(0, i + 1))}
                    className="text-amber-700 dark:text-white hover:underline truncate max-w-[120px]"
                  >
                    {p.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {oneDrivePickerLoading ? (
                <div className="flex items-center gap-2 text-amber-700 dark:text-white py-4">
                  <Loader2 className="w-5 h-5 animate-spin" /> {t['account.loadingFolders']}
                </div>
              ) : (
                <ul className="space-y-1">
                  {oneDrivePickerPath.length > 0 && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setOneDrivePickerPath((prev) => prev.slice(0, -1))}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-100 dark:hover:bg-white/10 text-amber-900 dark:text-white"
                      >
                        <span className="font-medium">..</span> {t['account.parentFolder']}
                      </button>
                    </li>
                  )}
                  {oneDrivePickerFolders.map((f) => (
                    <li key={f.id}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOneDrivePickerPath((prev) => [...prev, { id: f.id, name: f.name }])}
                          className="flex-1 text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-100 dark:hover:bg-white/10 text-amber-900 dark:text-white"
                        >
                          <FolderOpen className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOneDriveSelectFolder(f.id)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                        >
                          {t['account.selectFolder']}
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

      {renameFolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !renameFolderLoading && setRenameFolderOpen(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border-2 border-amber-200 dark:border-white/20 max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-amber-900 dark:text-white">{t['account.renameFolder'] || 'Muuda kausta nime'}</h3>
              <button type="button" onClick={() => !renameFolderLoading && setRenameFolderOpen(null)} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-white/10 text-amber-900 dark:text-white" aria-label={t['common.close'] || 'Sulge'}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-amber-800 dark:text-white/90 mb-3">{t['account.renameFolderTitle'] || 'Uus kausta nimi'}</p>
            <input
              type="text"
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              placeholder={t['account.folderNamePlaceholder']}
              className="w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-white/30 dark:bg-black/50 dark:text-white text-amber-900 mb-3"
              disabled={renameFolderLoading}
            />
            {renameFolderError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{renameFolderError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => !renameFolderLoading && setRenameFolderOpen(null)}
                className="px-4 py-2 rounded-lg border border-amber-300 dark:border-white/30 text-amber-800 dark:text-white hover:bg-amber-50 dark:hover:bg-white/10"
              >
                {t['common.cancel'] || 'Tühista'}
              </button>
              <button
                type="button"
                onClick={handleRenameFolder}
                disabled={renameFolderLoading || !renameFolderName.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 disabled:opacity-60"
              >
                {renameFolderLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                {renameFolderLoading ? (t['feedback.creatingFolder'] || 'Salvestan…') : (t['account.renameFolder'] || 'Muuda nime')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

