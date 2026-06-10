import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Folder, FolderOpen, FolderPlus, Loader2 } from 'lucide-react';
import * as googleDrive from '../../services/googleDrive';
import * as oneDrive from '../../services/oneDrive';
import * as authStorage from '../../services/authStorage';
import { COMPOSER_FILE_EXT } from '../../document/composerDocumentModel';

export default function ComposerFileInfoDialog({
  open,
  onClose,
  title,
  onTitleChange,
  provider,
  onProviderChange,
  folderId,
  onFolderChange,
  hasGoogle,
  hasMicrosoft,
  fileLockedProvider,
  onApply,
  busy,
  error,
}) {
  const [browsePath, setBrowsePath] = useState([]);
  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const effectiveProvider = fileLockedProvider || provider;
  const currentParentId = browsePath.length > 0 ? browsePath[browsePath.length - 1].id : 'root';

  const loadFolders = useCallback(async () => {
    if (!open) return;
    setFoldersLoading(true);
    setLocalError('');
    try {
      if (effectiveProvider === 'google') {
        const token = googleDrive.getStoredToken();
        if (!token) throw new Error('Google Drive sessioon puudub.');
        const list = await googleDrive.listFolderChildren(token, currentParentId === 'root' ? null : currentParentId);
        setFolders(list);
      } else {
        const token = authStorage.getStoredMicrosoftTokenFromAuth();
        if (!token) throw new Error('OneDrive sessioon puudub.');
        const result = await oneDrive.listFolderChildren(token, currentParentId === 'root' ? 'root' : currentParentId);
        if (!result.ok) throw new Error(result.error || 'Kaustade laadimine ebaõnnestus.');
        setFolders(result.folders || []);
      }
    } catch (e) {
      setFolders([]);
      setLocalError(e?.message || 'Kaustade laadimine ebaõnnestus.');
    } finally {
      setFoldersLoading(false);
    }
  }, [open, effectiveProvider, currentParentId]);

  useEffect(() => {
    if (!open) return;
    setBrowsePath([]);
    setNewFolderName('');
    setLocalError('');
  }, [open, effectiveProvider]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const selectFolderHere = () => {
    onFolderChange(currentParentId, browsePath);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setLocalError('Sisesta kausta nimi.');
      return;
    }
    setCreatingFolder(true);
    setLocalError('');
    try {
      if (effectiveProvider === 'google') {
        const token = googleDrive.getStoredToken();
        if (!token) throw new Error('Google Drive sessioon puudub.');
        const id = await googleDrive.createFolder(token, currentParentId, name);
        if (!id) throw new Error('Kausta loomine ebaõnnestus.');
        setNewFolderName('');
        await loadFolders();
        onFolderChange(id, [...browsePath, { id, name }]);
      } else {
        const token = authStorage.getStoredMicrosoftTokenFromAuth();
        if (!token) throw new Error('OneDrive sessioon puudub.');
        const result = await oneDrive.createFolder(token, currentParentId, name);
        if (!result.ok || !result.id) throw new Error(result.error || 'Kausta loomine ebaõnnestus.');
        setNewFolderName('');
        await loadFolders();
        onFolderChange(result.id, [...browsePath, { id: result.id, name: result.name || name }]);
      }
    } catch (e) {
      setLocalError(e?.message || 'Kausta loomine ebaõnnestus.');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handlePickGoogleFolder = async () => {
    const token = googleDrive.getStoredToken();
    if (!token) {
      setLocalError('Google Drive sessioon puudub.');
      return;
    }
    try {
      const pickedId = await googleDrive.pickFolder(token);
      if (!pickedId) return;
      const meta = await googleDrive.getFolderMetadata(token, pickedId);
      onFolderChange(pickedId, meta?.name ? [{ id: pickedId, name: meta.name }] : []);
      setBrowsePath(meta?.name ? [{ id: pickedId, name: meta.name }] : []);
    } catch (e) {
      setLocalError(e?.message || 'Kausta valimine ebaõnnestus.');
    }
  };

  if (!open) return null;

  const folderLabel = folderId === 'root' || !folderId
    ? 'Juurkaust (Drive)'
    : (browsePath.length > 0 ? browsePath.map((p) => p.name).join(' / ') : 'Valitud kaust');

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-amber-950/60 dark:bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border-2 border-amber-200 dark:border-white/20 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-file-info-title"
      >
        <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-5 py-3 flex items-center justify-between">
          <h2 id="composer-file-info-title" className="text-base font-bold">Faili andmed</h2>
          <button type="button" onClick={onClose} className="text-white/90 hover:text-white text-2xl leading-none" aria-label="Sulge">&times;</button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">Faili nimi</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Nimetu kujundus"
                className="flex-1 px-3 py-2 rounded-lg border-2 border-amber-200 dark:border-white/20 bg-amber-50 dark:bg-zinc-800 text-amber-900 dark:text-white"
              />
              <span className="text-sm text-amber-700 dark:text-white/70 whitespace-nowrap">{COMPOSER_FILE_EXT}</span>
            </div>
            <p className="text-xs text-amber-700/80 dark:text-white/60 mt-1">Salvestamisel kasutatakse seda nime ka Drive'i failina.</p>
          </div>

          {(hasGoogle || hasMicrosoft) && (
            <div>
              <span className="block text-sm font-semibold text-amber-900 dark:text-white mb-2">Pilveteenus</span>
              <div className="flex gap-2">
                {hasGoogle && (
                  <button
                    type="button"
                    disabled={!!fileLockedProvider && fileLockedProvider !== 'google'}
                    onClick={() => onProviderChange('google')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${effectiveProvider === 'google' ? 'bg-amber-600 text-white border-amber-700' : 'border-amber-200 dark:border-white/20 text-amber-900 dark:text-white hover:bg-amber-50 dark:hover:bg-white/10 disabled:opacity-50'}`}
                  >
                    Google Drive
                  </button>
                )}
                {hasMicrosoft && (
                  <button
                    type="button"
                    disabled={!!fileLockedProvider && fileLockedProvider !== 'onedrive'}
                    onClick={() => onProviderChange('onedrive')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${effectiveProvider === 'onedrive' ? 'bg-amber-600 text-white border-amber-700' : 'border-amber-200 dark:border-white/20 text-amber-900 dark:text-white hover:bg-amber-50 dark:hover:bg-white/10 disabled:opacity-50'}`}
                  >
                    OneDrive
                  </button>
                )}
              </div>
            </div>
          )}

          <div>
            <span className="block text-sm font-semibold text-amber-900 dark:text-white mb-1">Faili asukoht</span>
            <p className="text-xs text-amber-800 dark:text-white/70 mb-2">
              Valitud: <strong>{folderLabel}</strong>
            </p>

            <div className="flex items-center gap-1 py-1 text-sm text-amber-800 dark:text-white/90 mb-2 flex-wrap">
              <button type="button" onClick={() => setBrowsePath([])} className="hover:underline font-medium">Juurkaust</button>
              {browsePath.map((p, i) => (
                <React.Fragment key={p.id}>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  <button type="button" onClick={() => setBrowsePath(browsePath.slice(0, i + 1))} className="hover:underline truncate max-w-[140px]">{p.name}</button>
                </React.Fragment>
              ))}
            </div>

            <button
              type="button"
              onClick={selectFolderHere}
              className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-white font-medium hover:bg-amber-200 dark:hover:bg-amber-800/40"
            >
              <FolderOpen className="w-4 h-4" />
              Vali see kaust ({currentParentId === 'root' ? 'Juurkaust' : browsePath[browsePath.length - 1]?.name || 'kaust'})
            </button>

            {effectiveProvider === 'google' && hasGoogle && (
              <button
                type="button"
                onClick={handlePickGoogleFolder}
                className="w-full mb-3 py-2 px-3 rounded-lg border border-amber-300 dark:border-white/20 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-50 dark:hover:bg-white/10"
              >
                Vali kaust Google Pickeriga…
              </button>
            )}

            {foldersLoading ? (
              <div className="flex items-center gap-2 text-amber-700 dark:text-white/80 py-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Laen kaustu…
              </div>
            ) : (
              <ul className="space-y-1 max-h-40 overflow-y-auto mb-3">
                {folders.map((f) => (
                  <li key={f.id}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBrowsePath((prev) => [...prev, { id: f.id, name: f.name }])}
                        className="flex-1 text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-amber-100 dark:hover:bg-white/10 text-amber-900 dark:text-white"
                      >
                        <Folder className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onFolderChange(f.id, [...browsePath, { id: f.id, name: f.name }])}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500"
                      >
                        Vali
                      </button>
                    </div>
                  </li>
                ))}
                {folders.length === 0 && !foldersLoading && (
                  <li className="text-xs text-amber-700/80 dark:text-white/60 px-2 py-1">Alamkaustu pole.</li>
                )}
              </ul>
            )}

            <div className="border-t border-amber-200 dark:border-white/20 pt-3">
              <p className="text-sm font-semibold text-amber-900 dark:text-white mb-2 flex items-center gap-2">
                <FolderPlus className="w-4 h-4" /> Loo uus kaust siia
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Kausta nimi"
                  className="flex-1 px-3 py-2 rounded-lg border-2 border-amber-200 dark:border-white/20 bg-amber-50 dark:bg-zinc-800 text-amber-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  disabled={creatingFolder}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 disabled:opacity-60 whitespace-nowrap"
                >
                  {creatingFolder ? 'Loon…' : 'Loo'}
                </button>
              </div>
            </div>
          </div>

          {(error || localError) && (
            <p className="text-sm text-red-700 dark:text-red-300">{error || localError}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-amber-200 dark:border-white/20 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg bg-amber-100 dark:bg-zinc-800 text-amber-900 dark:text-white font-semibold hover:bg-amber-200 dark:hover:bg-zinc-700">
            Tühista
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={busy}
            className="flex-1 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500 disabled:opacity-60"
          >
            {busy ? 'Salvestan…' : 'Salvesta faili andmed'}
          </button>
        </div>
      </div>
    </div>
  );
}
