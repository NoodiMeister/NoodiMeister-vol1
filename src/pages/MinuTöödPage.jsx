import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePlus, Folder, FolderOpen, FolderPlus, Cloud, LogIn, Loader2, PenTool, User, Settings, ChevronDown, Trash2, X, Pencil, FolderMinus, FolderInput, ChevronRight } from 'lucide-react';
import * as googleDrive from '../services/googleDrive';
import * as oneDrive from '../services/oneDrive';
import * as authStorage from '../services/authStorage';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, LOCALES, getTranslations } from '../i18n';
import { AppLogo } from '../components/AppLogo';
import { useNoodimeisterOptional } from '../store/NoodimeisterContext';

/** Error Boundary: sisselogimise järgne vaade – punane kast veateatega */
class MinuToodErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      const title = this.props.errorTitle || 'Viga rakenduse käivitamisel';
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
          <strong>{title}:</strong> {msg}
        </div>
      );
    }
    return this.props.children;
  }
}

function formatDate(iso, locale) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'et-EE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatOneDriveDate(item, locale) {
  return formatDate(item?.lastModifiedDateTime, locale);
}

export default function MinuTöödPage() {
  const navigate = useNavigate();
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
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState('NoodiMeister');
  const [createFolderLoading, setCreateFolderLoading] = useState(false);
  const [createFolderError, setCreateFolderError] = useState(null);
  const [googleFolders, setGoogleFolders] = useState([]);
  const [oneDriveFolders, setOneDriveFolders] = useState([]);
  const [filesByGoogleFolderId, setFilesByGoogleFolderId] = useState({});
  const [filesByOneDriveFolderId, setFilesByOneDriveFolderId] = useState({});
  const [googleExpandedIds, setGoogleExpandedIds] = useState(() => ({}));
  const [oneDriveExpandedIds, setOneDriveExpandedIds] = useState(() => ({}));
  const [renameOpen, setRenameOpen] = useState(null);
  const [renameName, setRenameName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState(null);
  const [moveOpen, setMoveOpen] = useState(null);
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState(null);
  const [moveGooglePath, setMoveGooglePath] = useState([]);
  const [moveGoogleFolders, setMoveGoogleFolders] = useState([]);
  const [moveGoogleLoading, setMoveGoogleLoading] = useState(false);
  const [moveOneDrivePath, setMoveOneDrivePath] = useState([]);
  const [moveOneDriveFolders, setMoveOneDriveFolders] = useState([]);
  const [moveOneDriveLoading, setMoveOneDriveLoading] = useState(false);
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

  // Ensure theme is applied when Minu tööd mounts (e.g. direct nav to /tood)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('noodimeister-theme');
      let mode = 'light';
      if (raw) {
        const o = JSON.parse(raw);
        mode = o.mode === 'dark' ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', mode);
    } catch (_) { /* ignore */ }
  }, []);

  const token = googleDrive.getStoredToken();
  const microsoftToken = authStorage.getStoredMicrosoftTokenFromAuth();
  const hasGoogle = !!token;
  const hasMicrosoft = !!microsoftToken;
  const provider = user?.provider || (hasGoogle ? 'google' : hasMicrosoft ? 'microsoft' : null);

  const refreshFolders = useCallback(() => {
    try {
      setGoogleFolders(authStorage.getGoogleSaveFolders());
      setOneDriveFolders(authStorage.getOneDriveSaveFolders());
    } catch (_) {}
  }, []);

  const loadFiles = useCallback(async () => {
    if (!token) {
      setFilesByGoogleFolderId({});
      setLoading(false);
      return;
    }
    const folders = authStorage.getGoogleSaveFolders();
    if (folders.length === 0) {
      setFilesByGoogleFolderId({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const byId = {};
      await Promise.all(
        folders.map(async (f) => {
          try {
            const list = await googleDrive.listNoodimeisterFiles(token, { folderId: f.id });
            byId[f.id] = list;
          } catch {
            byId[f.id] = [];
          }
        })
      );
      setFilesByGoogleFolderId(byId);
    } catch (e) {
      setError(e?.message || (t['mywork.worksLoadError'] || 'Tööde laadimine ebaõnnestus'));
      setFilesByGoogleFolderId({});
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  const loadOneDriveFiles = useCallback(async () => {
    if (!microsoftToken) {
      setFilesByOneDriveFolderId({});
      setOneDriveLoading(false);
      return;
    }
    const folders = authStorage.getOneDriveSaveFolders();
    if (folders.length === 0) {
      setFilesByOneDriveFolderId({});
      setOneDriveLoading(false);
      return;
    }
    setOneDriveLoading(true);
    setOneDriveError(null);
    try {
      const byId = {};
      await Promise.all(
        folders.map(async (f) => {
          try {
            const result = await oneDrive.listNoodimeisterFilesFromOneDrive(microsoftToken, f.id);
            byId[f.id] = result.ok ? (result.files || []) : [];
          } catch {
            byId[f.id] = [];
          }
        })
      );
      setFilesByOneDriveFolderId(byId);
    } catch (e) {
      setOneDriveError(e?.message || (t['mywork.oneDriveLoadError'] || 'OneDrive laadimine ebaõnnestus'));
      setFilesByOneDriveFolderId({});
    } finally {
      setOneDriveLoading(false);
    }
  }, [microsoftToken, t]);

  useEffect(() => {
    refreshFolders();
  }, [refreshFolders]);
  useEffect(() => {
    loadFiles();
  }, [loadFiles, googleFolders.length]);
  useEffect(() => {
    loadOneDriveFiles();
  }, [loadOneDriveFiles, oneDriveFolders.length]);

  // Populate folder names from API when missing (e.g. legacy single folder)
  useEffect(() => {
    if (!token) return;
    const folders = authStorage.getGoogleSaveFolders();
    let cancelled = false;
    folders.forEach((f) => {
      if (f.name) return;
      googleDrive.getFolderMetadata(token, f.id).then((meta) => {
        if (!cancelled && meta?.name) authStorage.updateGoogleSaveFolderName(f.id, meta.name);
        if (!cancelled) refreshFolders();
      });
    });
    return () => { cancelled = true; };
  }, [token, googleFolders.length, refreshFolders]);
  useEffect(() => {
    if (!microsoftToken) return;
    const folders = authStorage.getOneDriveSaveFolders();
    let cancelled = false;
    folders.forEach((f) => {
      if (f.name) return;
      oneDrive.getItemName(microsoftToken, f.id).then((name) => {
        if (!cancelled && name) authStorage.updateOneDriveSaveFolderName(f.id, name);
        if (!cancelled) refreshFolders();
      });
    });
    return () => { cancelled = true; };
  }, [microsoftToken, oneDriveFolders.length, refreshFolders]);

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
      setError(e?.message || (t['account.deleteError'] || 'Kustutamine ebaõnnestus'));
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
      setOneDriveError(e?.message || (t['account.deleteError'] || 'Kustutamine ebaõnnestus'));
    }
  }, [microsoftToken, loadOneDriveFiles, t]);

  const handleRenameFolder = useCallback(async () => {
    if (!renameOpen || !renameName.trim()) return;
    const { folderId, provider } = renameOpen;
    setRenameError(null);
    setRenameLoading(true);
    try {
      if (provider === 'google' && token) {
        await googleDrive.renameFolder(token, folderId, renameName.trim());
        authStorage.updateGoogleSaveFolderName(folderId, renameName.trim());
        refreshFolders();
        setRenameOpen(null);
        setRenameName('');
      } else if (provider === 'onedrive' && microsoftToken) {
        const result = await oneDrive.renameItem(microsoftToken, folderId, renameName.trim());
        if (result.ok) {
          authStorage.updateOneDriveSaveFolderName(folderId, result.name || renameName.trim());
          refreshFolders();
          setRenameOpen(null);
          setRenameName('');
        } else {
          setRenameError(result.error || (t['account.createFolderError'] || 'Ümbernimetamine ebaõnnestus'));
        }
      }
    } catch (e) {
      setRenameError(e?.message || (t['account.createFolderError'] || 'Ümbernimetamine ebaõnnestus'));
    } finally {
      setRenameLoading(false);
    }
  }, [renameOpen, renameName, token, microsoftToken, t, refreshFolders]);

  const handleRemoveFolderFromList = useCallback((folderId, provider) => {
    const msg = t['mywork.removeFolderFromList'] || 'Eemalda kaust nimekirjast? Failid jäävad pilve.';
    if (!window.confirm(msg)) return;
    if (provider === 'google') {
      authStorage.removeGoogleSaveFolder(folderId);
      refreshFolders();
      loadFiles();
    } else {
      authStorage.removeOneDriveSaveFolder(folderId);
      refreshFolders();
      loadOneDriveFiles();
    }
  }, [t, refreshFolders, loadFiles, loadOneDriveFiles]);

  const loadMoveGoogleFolders = useCallback(async (parentId) => {
    if (!token) return;
    setMoveGoogleLoading(true);
    try {
      const list = await googleDrive.listFolderChildren(token, parentId);
      setMoveGoogleFolders(list);
    } catch {
      setMoveGoogleFolders([]);
    } finally {
      setMoveGoogleLoading(false);
    }
  }, [token]);

  const loadMoveOneDriveFolders = useCallback(async (parentId) => {
    if (!microsoftToken) return;
    setMoveOneDriveLoading(true);
    const result = await oneDrive.listFolderChildren(microsoftToken, parentId);
    setMoveOneDriveLoading(false);
    setMoveOneDriveFolders(result.ok ? (result.folders || []) : []);
  }, [microsoftToken]);

  useEffect(() => {
    if (moveOpen?.provider === 'google' && token) {
      const parentId = moveGooglePath.length > 0 ? moveGooglePath[moveGooglePath.length - 1].id : null;
      loadMoveGoogleFolders(parentId);
    }
  }, [moveOpen?.provider, moveOpen?.folderId, token, moveGooglePath.length, moveGooglePath[moveGooglePath.length - 1]?.id, loadMoveGoogleFolders]);

  useEffect(() => {
    if (moveOpen?.provider === 'onedrive' && microsoftToken) {
      const parentId = moveOneDrivePath.length > 0 ? moveOneDrivePath[moveOneDrivePath.length - 1].id : null;
      loadMoveOneDriveFolders(parentId);
    }
  }, [moveOpen?.provider, moveOpen?.folderId, microsoftToken, moveOneDrivePath.length, moveOneDrivePath[moveOneDrivePath.length - 1]?.id, loadMoveOneDriveFolders]);

  const handleMoveFolderGoogleTo = useCallback(async (targetParentId) => {
    if (!moveOpen || moveOpen.provider !== 'google' || !token) return;
    if (targetParentId === moveOpen.folderId) return;
    setMoveError(null);
    setMoveLoading(true);
    try {
      await googleDrive.moveFolder(token, moveOpen.folderId, targetParentId);
      refreshFolders();
      loadFiles();
      setMoveOpen(null);
      setMoveGooglePath([]);
    } catch (e) {
      setMoveError(e?.message || (t['mywork.moveFolderError'] || 'Teisaldamine ebaõnnestus'));
    } finally {
      setMoveLoading(false);
    }
  }, [moveOpen, token, t, refreshFolders, loadFiles]);

  const handleMoveFolderOneDriveTo = useCallback(async (targetParentId) => {
    if (!moveOpen || moveOpen.provider !== 'onedrive' || !microsoftToken) return;
    setMoveError(null);
    setMoveLoading(true);
    try {
      const result = await oneDrive.moveItem(microsoftToken, moveOpen.folderId, targetParentId);
      if (result.ok) {
        refreshFolders();
        loadOneDriveFiles();
        setMoveOpen(null);
        setMoveOneDrivePath([]);
      } else {
        setMoveError(result.error || (t['mywork.moveFolderError'] || 'Teisaldamine ebaõnnestus'));
      }
    } catch (e) {
      setMoveError(e?.message || (t['mywork.moveFolderError'] || 'Teisaldamine ebaõnnestus'));
    } finally {
      setMoveLoading(false);
    }
  }, [moveOpen, microsoftToken, t, refreshFolders, loadOneDriveFiles]);

  const handleCreateFolder = useCallback(async () => {
    const name = (createFolderName || 'NoodiMeister').trim();
    if (!name) return;
    setCreateFolderError(null);
    setCreateFolderLoading(true);
    try {
      if (provider === 'google' && token) {
        const folderId = await googleDrive.createFolder(token, 'root', name);
        authStorage.addGoogleSaveFolder(folderId, name);
        refreshFolders();
        setCreateFolderOpen(false);
        setCreateFolderName('NoodiMeister');
        await loadFiles();
      } else if (provider === 'microsoft' && microsoftToken) {
        let parentId = authStorage.getOneDriveSaveFolderId() || 'root';
        let result = await oneDrive.createFolder(microsoftToken, parentId, name);
        if (!result.ok && parentId !== 'root' && /item not found|not found|404/i.test(String(result?.error || ''))) {
          authStorage.clearOneDriveSaveFolder();
          parentId = 'root';
          result = await oneDrive.createFolder(microsoftToken, parentId, name);
        }
        if (result.ok && result.id) {
          authStorage.addOneDriveSaveFolder(result.id, result.name || name);
          refreshFolders();
          setCreateFolderOpen(false);
          setCreateFolderName('NoodiMeister');
          await loadOneDriveFiles();
        } else {
          setCreateFolderError(result?.error || (t['account.createFolderError'] || 'Kausta loomine ebaõnnestus'));
        }
      }
    } catch (e) {
      setCreateFolderError(e?.message || (t['account.createFolderError'] || 'Kausta loomine ebaõnnestus'));
    } finally {
      setCreateFolderLoading(false);
    }
  }, [provider, token, microsoftToken, createFolderName, t, loadFiles, loadOneDriveFiles, refreshFolders]);

  useEffect(() => {
    if (authReady && !user) navigate('/login', { replace: true });
  }, [authReady, user, navigate]);

  if (!authReady || !user) {
    return <div className="loading-screen">{t['mywork.loadingApp']}</div>;
  }

  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';
  const basePath = base.replace(/\/$/, '') || '';
  const hrefNew = `${basePath}/app?new=1`;
  const hrefLocal = `${basePath}/app?local=1`;

  return (
    <MinuToodErrorBoundary errorTitle={t['mywork.errorBoundaryTitle']}>
    <div
      className="minutood-page min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black"
      style={{ position: 'relative', zIndex: 1, pointerEvents: 'auto' }}
    >
      <header className="flex-shrink-0 border-b border-amber-200/60 dark:border-white/20 bg-white/70 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <Link to="/" className="flex items-center">
            <AppLogo variant="header" alt="NoodiMeister" />
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
                <div className="minutood-settings-dropdown absolute right-0 top-full mt-1 min-w-[200px] py-2 rounded-xl bg-white dark:bg-zinc-900 border-2 border-amber-200 dark:border-white/20 shadow-xl z-50">
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
            <Link to="/app?local=1" className="inline-flex items-center gap-1.5 text-amber-700 dark:text-white hover:text-amber-900 dark:hover:text-white/90 p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-white/10 transition-colors" aria-label={t['nav.openNotationTool'] || 'Ava nooditööriist'} title={t['nav.openNotationTool'] || 'Ava nooditööriist'}>
              <PenTool className="w-5 h-5" />
              <span className="text-sm font-medium">{t['nav.openNotationTool'] || 'Tööriist'}</span>
            </Link>
            <Link to="/konto" className="text-amber-700 dark:text-white hover:text-amber-900 dark:hover:text-white/90 p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-white/10 transition-colors flex items-center gap-1" title={t['user.myAccount']}>
              <User className="w-5 h-5" /> {t['user.myAccount']}
            </Link>
            <Link to="/" className="text-amber-700 dark:text-white hover:text-amber-900 dark:hover:text-white/90 font-medium">{t['account.home']}</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
        <h1 className="text-2xl font-bold text-amber-900 dark:text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>
          {t['account.myWork']}
        </h1>
        <p className="text-amber-800/90 dark:text-white/90 mb-2">
          {t['mywork.intro']}
        </p>
        {(provider === 'google' || provider === 'microsoft') && (
          <p className="text-sm text-amber-700/90 dark:text-white/80 mb-6 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {t['mywork.storageLocation']}: {provider === 'microsoft' ? 'OneDrive' : 'Google Drive'}
            {' · '}
            <Link to="/konto" className="text-amber-800 dark:text-white font-medium hover:underline">{t['user.myAccount']}</Link>
            {' '}{t['mywork.viewOrChangeStorage']}
          </p>
        )}
        {!hasGoogle && !hasMicrosoft && (
          <div className="rounded-xl bg-amber-100/80 dark:bg-zinc-900 dark:border-white/20 border border-amber-200/60 p-6 mb-8">
            <div className="flex items-start gap-3">
              <Cloud className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-amber-900 dark:text-white mb-1">{t['mywork.cloudSavedWorks']}</h2>
                <p className="text-sm text-amber-800/90 dark:text-white/90 mb-4">
                  {t["mywork.signInToSeeCloud"]}
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors"
                >
                  <LogIn className="w-4 h-4" /> {t['account.logIn']}
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-amber-900 dark:text-white mb-3">{t['mywork.lastModifiedWorks']}</h2>
          <p className="text-sm text-amber-800/90 dark:text-white/90 mb-4">
            {t['mywork.lastModifiedHint']}
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href={hrefNew}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold shadow-lg hover:shadow-xl hover:from-amber-500 hover:to-orange-500 transition-all no-underline"
            >
              <FilePlus className="w-5 h-5" /> {t['mywork.newWork']}
            </a>
            <a
              href={hrefLocal}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-amber-400 bg-white dark:bg-zinc-900 text-amber-800 dark:text-white font-semibold hover:bg-amber-50 dark:hover:bg-white/10 transition-colors no-underline"
            >
              <FolderOpen className="w-5 h-5" /> {t['mywork.openLastModified']}
            </a>
            {(hasGoogle || hasMicrosoft) && (
              <button
                type="button"
                onClick={() => { setCreateFolderError(null); setCreateFolderOpen(true); }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-amber-400 bg-white text-amber-800 font-semibold hover:bg-amber-50 transition-colors"
                title={t['works.createFolderTitle'] || 'Loo uus kaust pilve salvestuskohta'}
              >
                <FolderPlus className="w-5 h-5" /> {t['works.createFolder'] || 'Loo kaust'}
              </button>
            )}
          </div>
        </div>

        {hasGoogle && (
          <section>
            <h2 className="text-lg font-semibold text-amber-900 dark:text-white mb-3">{t['mywork.cloudFilesGoogle']}</h2>
            {loading && (
              <div className="flex items-center gap-2 text-amber-700 py-8">
                <Loader2 className="w-5 h-5 animate-spin" /> {t['mywork.loadingWorks']}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 p-4 mb-4">
                {error}
              </div>
            )}
            {!loading && !error && googleFolders.length === 0 && (
              <p className="text-amber-700/90 dark:text-white/80 py-6">{t["mywork.noGoogleFilesHint"]}</p>
            )}
            {!loading && !error && googleFolders.map((folder) => {
              const expanded = googleExpandedIds[folder.id] !== false;
              const files = filesByGoogleFolderId[folder.id] || [];
              const displayName = folder.name || (t['mywork.saveFolderLabel'] || 'Salvestuskaust');
              return (
                <div key={folder.id} className="mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGoogleExpandedIds((prev) => ({ ...prev, [folder.id]: !expanded }))}
                      className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-amber-300/80 dark:border-amber-500/50 bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100/80 dark:hover:bg-amber-900/30 transition-colors text-left"
                      aria-expanded={expanded}
                      aria-label={expanded ? (t['mywork.collapseFolder'] || 'Sulge kaust') : (t['mywork.expandFolder'] || 'Ava kaust')}
                    >
                      {expanded ? (
                        <FolderOpen className="w-8 h-8 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                      ) : (
                        <Folder className="w-8 h-8 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                      )}
                      <span className="font-semibold text-amber-900 dark:text-white flex-1 truncate">
                        {displayName}
                      </span>
                      <span className="text-sm text-amber-700 dark:text-white/80 flex-shrink-0 hidden sm:inline">
                        {t['mywork.saveFolderHint'] || 'Uued failid salvestatakse siia.'}
                      </span>
                      <ChevronDown className={`w-5 h-5 flex-shrink-0 text-amber-700 dark:text-white/80 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRenameOpen({ folderId: folder.id, provider: 'google' }); setRenameName(folder.name || ''); setRenameError(null); }}
                      className="p-2 rounded-lg text-amber-700 dark:text-white/80 hover:bg-amber-100 dark:hover:bg-white/10 border border-amber-200/60 dark:border-white/20"
                      title={t['mywork.renameFolder'] || 'Muuda kausta nime'}
                      aria-label={t['mywork.renameFolder'] || 'Muuda kausta nime'}
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMoveOpen({ folderId: folder.id, provider: 'google', folderName: displayName }); setMoveError(null); setMoveGooglePath([]); }}
                      className="p-2 rounded-lg text-amber-700 dark:text-white/80 hover:bg-amber-100 dark:hover:bg-white/10 border border-amber-200/60 dark:border-white/20"
                      title={t['mywork.moveFolder'] || 'Teisalda kaust'}
                      aria-label={t['mywork.moveFolder'] || 'Teisalda kaust'}
                    >
                      <FolderInput className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveFolderFromList(folder.id, 'google')}
                      className="p-2 rounded-lg text-amber-700 dark:text-white/80 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 border border-amber-200/60 dark:border-white/20"
                      title={t['mywork.removeFolderFromList'] || 'Eemalda nimekirjast'}
                      aria-label={t['mywork.removeFolderFromList'] || 'Eemalda nimekirjast'}
                    >
                      <FolderMinus className="w-5 h-5" />
                    </button>
                  </div>
                  {expanded && (
                    <ul className="space-y-2 mt-2 ml-4 pl-6 border-l-2 border-amber-200/60 dark:border-amber-600/40" role="list">
                      {files.length === 0 ? (
                        <li className="py-4 text-sm text-amber-700/90 dark:text-white/80 pl-2">
                          {t["mywork.noGoogleFilesHint"]}
                        </li>
                      ) : (
                        files.map((f, index) => (
                          <li
                            key={f.id}
                            className="flex items-center gap-2"
                            style={{ marginLeft: `${Math.min(index * 4, 12)}px` }}
                          >
                            <a
                              href={`${basePath}/app?fileId=${encodeURIComponent(f.id)}`}
                              className="flex-1 min-w-0 text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-white/20 shadow-sm hover:bg-amber-50 dark:hover:bg-white/10 hover:border-amber-300 dark:hover:border-white/30 transition-colors no-underline text-inherit text-amber-900 dark:text-white"
                            >
                              <AppLogo variant="iconMd" alt="" />
                              <span className="font-medium text-amber-900 dark:text-white truncate flex-1">{f.name}</span>
                              <span className="text-sm text-amber-600 dark:text-white/70 flex-shrink-0">{formatDate(f.modifiedTime, locale)}</span>
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
                        ))
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {hasMicrosoft && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-amber-900 dark:text-white mb-3">{t['mywork.cloudFilesOneDrive']}</h2>
            {oneDriveLoading && (
              <div className="flex items-center gap-2 text-amber-700 py-8">
                <Loader2 className="w-5 h-5 animate-spin" /> {t['mywork.loadingWorks']}
              </div>
            )}
            {oneDriveError && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 p-4 mb-4">
                {oneDriveError}
              </div>
            )}
            {!oneDriveLoading && !oneDriveError && oneDriveFolders.length === 0 && (
              <p className="text-amber-700/90 dark:text-white/80 py-6">{t["mywork.noOneDriveFilesHint"]}</p>
            )}
            {!oneDriveLoading && !oneDriveError && oneDriveFolders.map((folder) => {
              const expanded = oneDriveExpandedIds[folder.id] !== false;
              const files = filesByOneDriveFolderId[folder.id] || [];
              const displayName = folder.name || (t['mywork.saveFolderLabel'] || 'Salvestuskaust');
              return (
                <div key={folder.id} className="mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOneDriveExpandedIds((prev) => ({ ...prev, [folder.id]: !expanded }))}
                      className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-amber-300/80 dark:border-amber-500/50 bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100/80 dark:hover:bg-amber-900/30 transition-colors text-left"
                      aria-expanded={expanded}
                      aria-label={expanded ? (t['mywork.collapseFolder'] || 'Sulge kaust') : (t['mywork.expandFolder'] || 'Ava kaust')}
                    >
                      {expanded ? (
                        <FolderOpen className="w-8 h-8 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                      ) : (
                        <Folder className="w-8 h-8 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                      )}
                      <span className="font-semibold text-amber-900 dark:text-white flex-1 truncate">
                        {displayName}
                      </span>
                      <span className="text-sm text-amber-700 dark:text-white/80 flex-shrink-0 hidden sm:inline">
                        {t['mywork.saveFolderHint'] || 'Uued failid salvestatakse siia.'}
                      </span>
                      <ChevronDown className={`w-5 h-5 flex-shrink-0 text-amber-700 dark:text-white/80 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRenameOpen({ folderId: folder.id, provider: 'onedrive' }); setRenameName(folder.name || ''); setRenameError(null); }}
                      className="p-2 rounded-lg text-amber-700 dark:text-white/80 hover:bg-amber-100 dark:hover:bg-white/10 border border-amber-200/60 dark:border-white/20"
                      title={t['mywork.renameFolder'] || 'Muuda kausta nime'}
                      aria-label={t['mywork.renameFolder'] || 'Muuda kausta nime'}
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMoveOpen({ folderId: folder.id, provider: 'onedrive', folderName: displayName }); setMoveError(null); setMoveOneDrivePath([]); }}
                      className="p-2 rounded-lg text-amber-700 dark:text-white/80 hover:bg-amber-100 dark:hover:bg-white/10 border border-amber-200/60 dark:border-white/20"
                      title={t['mywork.moveFolder'] || 'Teisalda kaust'}
                      aria-label={t['mywork.moveFolder'] || 'Teisalda kaust'}
                    >
                      <FolderInput className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveFolderFromList(folder.id, 'onedrive')}
                      className="p-2 rounded-lg text-amber-700 dark:text-white/80 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 border border-amber-200/60 dark:border-white/20"
                      title={t['mywork.removeFolderFromList'] || 'Eemalda nimekirjast'}
                      aria-label={t['mywork.removeFolderFromList'] || 'Eemalda nimekirjast'}
                    >
                      <FolderMinus className="w-5 h-5" />
                    </button>
                  </div>
                  {expanded && (
                    <ul className="space-y-2 mt-2 ml-4 pl-6 border-l-2 border-amber-200/60 dark:border-amber-600/40" role="list">
                      {files.length === 0 ? (
                        <li className="py-4 text-sm text-amber-700/90 dark:text-white/80 pl-2">
                          {t["mywork.noOneDriveFilesHint"]}
                        </li>
                      ) : (
                        files.map((f, index) => (
                          <li
                            key={f.id}
                            className="flex items-center gap-2"
                            style={{ marginLeft: `${Math.min(index * 4, 12)}px` }}
                          >
                            <a
                              href={`${basePath}/app?fileId=${encodeURIComponent(f.id)}&cloud=onedrive`}
                              className="flex-1 min-w-0 text-left flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-white/20 shadow-sm hover:bg-amber-50 dark:hover:bg-white/10 hover:border-amber-300 dark:hover:border-white/30 transition-colors no-underline text-inherit text-amber-900 dark:text-white"
                            >
                              <AppLogo variant="iconMd" alt="" />
                              <span className="font-medium text-amber-900 dark:text-white truncate flex-1">{f.name}</span>
                              <span className="text-sm text-amber-600 dark:text-white/70 flex-shrink-0">{formatOneDriveDate(f, locale)}</span>
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
                        ))
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {moveOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !moveLoading && setMoveOpen(null)}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border-2 border-amber-200 dark:border-white/20 max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200 dark:border-white/20">
                <h3 className="font-semibold text-amber-900 dark:text-white">{t['mywork.moveFolderTitle'] || 'Teisalda kaust teise asukohta'}</h3>
                <button type="button" onClick={() => !moveLoading && setMoveOpen(null)} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-white/10 text-amber-900 dark:text-white" aria-label={t['common.close'] || 'Sulge'}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto">
                <p className="text-sm text-amber-800 dark:text-white/90 mb-3">
                  {t['mywork.moveFolderPickLocation'] || 'Vali uus asukoht'}
                  {moveOpen.folderName && <><br /><strong>{moveOpen.folderName}</strong></>}
                </p>
                {moveError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mb-3">{moveError}</p>
                )}
                {moveOpen.provider === 'google' && (
                  <>
                    <div className="flex items-center gap-1 py-2 text-sm text-amber-800 dark:text-white/90 mb-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setMoveGooglePath([])}
                        className="hover:underline font-medium"
                      >
                        {t['account.rootFolder'] || 'Juurkaust'}
                      </button>
                      {moveGooglePath.map((p, i) => (
                        <React.Fragment key={p.id}>
                          <ChevronRight className="w-4 h-4 flex-shrink-0" />
                          <button
                            type="button"
                            onClick={() => setMoveGooglePath(moveGooglePath.slice(0, i + 1))}
                            className="hover:underline truncate max-w-[140px]"
                          >
                            {p.name}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="space-y-1 mb-3">
                      <button
                        type="button"
                        onClick={() => handleMoveFolderGoogleTo(moveGooglePath.length > 0 ? moveGooglePath[moveGooglePath.length - 1].id : 'root')}
                        disabled={moveLoading}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-white font-medium hover:bg-amber-200 dark:hover:bg-amber-800/40 disabled:opacity-60"
                      >
                        <FolderOpen className="w-4 h-4" />
                        {moveGooglePath.length > 0 ? (t['account.selectFolder'] || 'Vali siia') : (t['account.rootFolder'] || 'Juurkaust')} – {t['account.selectFolder'] || 'Vali siia'}
                      </button>
                    </div>
                    {moveGoogleLoading ? (
                      <div className="flex items-center gap-2 text-amber-700 dark:text-white/80 py-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> {t['mywork.loadingWorks'] || 'Laen…'}
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {moveGoogleFolders.map((f) => (
                          <li key={f.id}>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setMoveGooglePath((prev) => [...prev, { id: f.id, name: f.name }])}
                                className="flex-1 text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-100 dark:hover:bg-white/10 text-amber-900 dark:text-white"
                              >
                                <Folder className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{f.name}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveFolderGoogleTo(f.id)}
                                disabled={moveLoading}
                                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-60"
                              >
                                {t['account.selectFolder'] || 'Vali'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                {moveOpen.provider === 'onedrive' && (
                  <>
                    <div className="flex items-center gap-1 py-2 text-sm text-amber-800 dark:text-white/90 mb-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setMoveOneDrivePath([])}
                        className="hover:underline font-medium"
                      >
                        {t['account.rootFolder'] || 'Juurkaust'}
                      </button>
                      {moveOneDrivePath.map((p, i) => (
                        <React.Fragment key={p.id}>
                          <ChevronRight className="w-4 h-4 flex-shrink-0" />
                          <button
                            type="button"
                            onClick={() => setMoveOneDrivePath(moveOneDrivePath.slice(0, i + 1))}
                            className="hover:underline truncate max-w-[140px]"
                          >
                            {p.name}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="space-y-1 mb-3">
                      <button
                        type="button"
                        onClick={() => handleMoveFolderOneDriveTo(moveOneDrivePath.length > 0 ? moveOneDrivePath[moveOneDrivePath.length - 1].id : 'root')}
                        disabled={moveLoading}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-white font-medium hover:bg-amber-200 dark:hover:bg-amber-800/40 disabled:opacity-60"
                      >
                        <FolderOpen className="w-4 h-4" />
                        {moveOneDrivePath.length > 0 ? (t['account.selectFolder'] || 'Vali siia') : (t['account.rootFolder'] || 'Juurkaust')} – {t['account.selectFolder'] || 'Vali siia'}
                      </button>
                    </div>
                    {moveOneDriveLoading ? (
                      <div className="flex items-center gap-2 text-amber-700 dark:text-white/80 py-2">
                        <Loader2 className="w-5 h-5 animate-spin" /> {t['mywork.loadingWorks'] || 'Laen…'}
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {moveOneDriveFolders.map((f) => (
                          <li key={f.id}>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setMoveOneDrivePath((prev) => [...prev, { id: f.id, name: f.name }])}
                                className="flex-1 text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-100 dark:hover:bg-white/10 text-amber-900 dark:text-white"
                              >
                                <Folder className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{f.name}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveFolderOneDriveTo(f.id)}
                                disabled={moveLoading}
                                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-60"
                              >
                                {t['account.selectFolder'] || 'Vali'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {renameOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !renameLoading && setRenameOpen(null)}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border-2 border-amber-200 dark:border-white/20 max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-amber-900 dark:text-white">{t['mywork.renameFolder'] || 'Muuda kausta nime'}</h3>
                <button type="button" onClick={() => !renameLoading && setRenameOpen(null)} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-white/10 text-amber-900 dark:text-white" aria-label={t['common.close'] || 'Sulge'}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-amber-800 dark:text-white/90 mb-3">{t['mywork.renameFolderTitle'] || 'Kausta nimi'}</p>
              <input
                type="text"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder={t['cloud.folderName'] || 'Kausta nimi'}
                className="w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-white/30 dark:bg-black/50 dark:text-white text-amber-900 mb-3"
                disabled={renameLoading}
              />
              {renameError && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-3">{renameError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => !renameLoading && setRenameOpen(null)}
                  className="px-4 py-2 rounded-lg border border-amber-300 dark:border-white/30 text-amber-800 dark:text-white hover:bg-amber-50 dark:hover:bg-white/10"
                >
                  {t['common.cancel'] || 'Tühista'}
                </button>
                <button
                  type="button"
                  onClick={handleRenameFolder}
                  disabled={renameLoading || !renameName.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 disabled:opacity-60"
                >
                  {renameLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                  {renameLoading ? (t['feedback.creatingFolder'] || 'Salvestan…') : (t['account.renameFolder'] || 'Muuda nime')}
                </button>
              </div>
            </div>
          </div>
        )}

        {createFolderOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !createFolderLoading && setCreateFolderOpen(false)}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border-2 border-amber-200 dark:border-white/20 max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-amber-900 dark:text-white">{t['works.createFolder'] || 'Loo kaust'}</h3>
                <button type="button" onClick={() => !createFolderLoading && setCreateFolderOpen(false)} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-white/10 text-amber-900 dark:text-white" aria-label={t['common.close'] || 'Sulge'}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-amber-800 dark:text-white/90 mb-3">{t['works.createFolderTitle'] || 'Loo uus kaust pilve salvestuskohta'}</p>
              <input
                type="text"
                value={createFolderName}
                onChange={(e) => setCreateFolderName(e.target.value)}
                placeholder={t['cloud.folderName'] || 'Kausta nimi'}
                className="w-full px-3 py-2 rounded-lg border border-amber-200 dark:border-white/30 dark:bg-black/50 dark:text-white text-amber-900 mb-3"
                disabled={createFolderLoading}
              />
              {createFolderError && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-3">{createFolderError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => !createFolderLoading && setCreateFolderOpen(false)}
                  className="px-4 py-2 rounded-lg border border-amber-300 dark:border-white/30 text-amber-800 dark:text-white hover:bg-amber-50 dark:hover:bg-white/10"
                >
                  {t['common.cancel'] || 'Tühista'}
                </button>
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  disabled={createFolderLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 disabled:opacity-60"
                >
                  {createFolderLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                  {createFolderLoading ? (t['feedback.creatingFolder'] || 'Loon kausta…') : (t['works.createFolder'] || 'Loo kaust')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
    </MinuToodErrorBoundary>
  );
}
