import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppLogo } from '../components/AppLogo';
import ComposerSidebar from '../components/composer/ComposerSidebar';
import ComposerCanvas from '../components/composer/ComposerCanvas';
import ComposerInspector from '../components/composer/ComposerInspector';
import {
  createComposerDocument,
  createComposerPage,
  createComposerBlockFromSvg,
  createComposerTextBox,
  normalizeComposerDocument,
  splitComposerBlock,
  touchMeta,
} from '../document/composerDocumentModel';
import { createComposerSvgBlockFromProjectJson } from '../utils/composerSvgBlocks';
import { exportComposerToPdf, printComposerDocument } from '../export/composerExport';
import * as googleDrive from '../services/googleDrive';
import * as oneDrive from '../services/oneDrive';
import * as authStorage from '../services/authStorage';

function downloadText(name, text) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ComposerPage() {
  const [searchParams] = useSearchParams();
  const [doc, setDoc] = useState(() => createComposerDocument());
  const [activeBlockId, setActiveBlockId] = useState('');
  const [busyMessage, setBusyMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const [toolMode, setToolMode] = useState('move');
  const importProjectRef = useRef(null);
  const importComposerRef = useRef(null);

  const activePage = useMemo(() => doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0], [doc]);
  const activeBlock = useMemo(
    () => (activePage?.blocks || []).find((b) => b.id === activeBlockId) || null,
    [activePage, activeBlockId]
  );

  const setPage = useCallback((patcher) => {
    setDoc((prev) => {
      const nextPages = prev.pages.map((page) => {
        if (page.id !== prev.activePageId) return page;
        return typeof patcher === 'function' ? patcher(page) : { ...page, ...patcher };
      });
      return touchMeta({ ...prev, pages: nextPages });
    });
  }, []);

  const addProjectJsonAsBlock = useCallback((raw, sourceName) => {
    const blockSeed = createComposerSvgBlockFromProjectJson(raw, sourceName);
    const block = createComposerBlockFromSvg({
      name: blockSeed.name,
      svgMarkup: blockSeed.svgMarkup,
      width: blockSeed.width,
      height: blockSeed.height,
      source: { sourceName, sourceWidth: blockSeed.sourceWidth, sourceHeight: blockSeed.sourceHeight },
    });
    setPage((page) => ({ ...page, blocks: [...page.blocks, block] }));
    setActiveBlockId(block.id);
  }, [setPage]);

  const handleUploadProject = useCallback(() => importProjectRef.current?.click(), []);
  const handleUploadComposer = useCallback(() => importComposerRef.current?.click(), []);

  const onProjectFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const raw = await file.text();
    addProjectJsonAsBlock(raw, file.name || 'Project');
  }, [addProjectJsonAsBlock]);

  const onComposerFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const raw = await file.text();
    try {
      const parsed = JSON.parse(raw);
      const next = normalizeComposerDocument(parsed);
      setDoc(next);
      setActiveBlockId('');
      setFeedback('Composer project opened.');
    } catch {
      setFeedback('Could not parse .nmc file.');
    }
  }, []);

  const patchBlock = useCallback((id, patch) => {
    setPage((page) => ({
      ...page,
      blocks: page.blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)),
    }));
  }, [setPage]);

  const patchActiveBlock = useCallback((patch) => {
    if (!activeBlockId) return;
    patchBlock(activeBlockId, patch);
  }, [activeBlockId, patchBlock]);

  const deleteActiveBlock = useCallback(() => {
    if (!activeBlockId) return;
    setPage((page) => ({
      ...page,
      blocks: page.blocks.filter((block) => block.id !== activeBlockId),
    }));
    setActiveBlockId('');
  }, [activeBlockId, setPage]);

  const addText = useCallback(() => {
    const block = createComposerTextBox('Uus tekst');
    setPage((page) => ({ ...page, blocks: [...page.blocks, block] }));
    setActiveBlockId(block.id);
  }, [setPage]);

  const addPage = useCallback(() => {
    const page = createComposerPage();
    setDoc((prev) => touchMeta({ ...prev, pages: [...prev.pages, page], activePageId: page.id }));
    setActiveBlockId('');
  }, []);

  const removeCurrentPage = useCallback(() => {
    setDoc((prev) => {
      if ((prev.pages || []).length <= 1) return prev;
      const idx = prev.pages.findIndex((p) => p.id === prev.activePageId);
      const nextPages = prev.pages.filter((p) => p.id !== prev.activePageId);
      const nextActive = nextPages[Math.max(0, Math.min(nextPages.length - 1, idx - 1))]?.id || nextPages[0]?.id;
      return touchMeta({ ...prev, pages: nextPages, activePageId: nextActive });
    });
    setActiveBlockId('');
  }, []);

  const switchPage = useCallback((id) => {
    setDoc((prev) => ({ ...prev, activePageId: id }));
    setActiveBlockId('');
  }, []);

  const moveBlockToPage = useCallback((blockId, targetPageId) => {
    setDoc((prev) => {
      const sourcePage = prev.pages.find((p) => p.blocks.some((b) => b.id === blockId));
      const targetPage = prev.pages.find((p) => p.id === targetPageId);
      if (!sourcePage || !targetPage) return prev;
      const block = sourcePage.blocks.find((b) => b.id === blockId);
      if (!block) return prev;
      const nextPages = prev.pages.map((p) => {
        if (p.id === sourcePage.id) return { ...p, blocks: p.blocks.filter((b) => b.id !== blockId) };
        if (p.id === targetPage.id) return { ...p, blocks: [...p.blocks, { ...block, x: 28, y: 28 }] };
        return p;
      });
      return touchMeta({ ...prev, pages: nextPages, activePageId: targetPageId });
    });
    setActiveBlockId(blockId);
  }, []);

  const splitBlockByScissor = useCallback((blockId, orientation, ratio) => {
    setPage((page) => {
      const block = page.blocks.find((b) => b.id === blockId);
      if (!block) return page;
      const parts = splitComposerBlock(block, orientation, ratio);
      if (parts.length < 2) return page;
      return {
        ...page,
        blocks: [
          ...page.blocks.filter((b) => b.id !== blockId),
          ...parts,
        ],
      };
    });
    setActiveBlockId('');
  }, [setPage]);

  const saveLocal = useCallback(() => {
    const name = `${(doc.meta?.title || 'composer').replace(/[^\w\-.]/g, '_')}.nmc`;
    downloadText(name, JSON.stringify(doc, null, 2));
  }, [doc]);

  const loadFromQueryFile = useCallback(async () => {
    const fileId = searchParams.get('fileId');
    if (!fileId) return;
    const cloud = searchParams.get('cloud') === 'onedrive' ? 'onedrive' : 'google';
    setBusyMessage('Loading source file…');
    try {
      if (cloud === 'onedrive') {
        const token = authStorage.getStoredMicrosoftTokenFromAuth();
        if (!token) throw new Error('OneDrive token missing.');
        const raw = await oneDrive.getFileContent(token, fileId);
        if (String(raw).trim().startsWith('{') && raw.includes('"type":"noodimeister-composer"')) {
          setDoc(normalizeComposerDocument(JSON.parse(raw)));
        } else {
          addProjectJsonAsBlock(raw, `OneDrive:${fileId}`);
        }
      } else {
        const token = googleDrive.getStoredToken();
        if (!token) throw new Error('Google token missing.');
        const raw = await googleDrive.getFileContent(token, fileId);
        if (String(raw).trim().startsWith('{') && raw.includes('"type":"noodimeister-composer"')) {
          setDoc(normalizeComposerDocument(JSON.parse(raw)));
        } else {
          addProjectJsonAsBlock(raw, `Google:${fileId}`);
        }
      }
      setFeedback('Loaded from cloud.');
    } catch (e) {
      setFeedback(e?.message || 'Cloud load failed.');
    } finally {
      setBusyMessage('');
    }
  }, [searchParams, addProjectJsonAsBlock]);

  const saveCloud = useCallback(async (provider) => {
    const serialized = JSON.stringify(doc);
    const fileId = searchParams.get('fileId');
    const saveFolderId = searchParams.get('saveFolderId') || 'root';
    try {
      setBusyMessage('Saving composer to cloud…');
      if (provider === 'onedrive') {
        const token = authStorage.getStoredMicrosoftTokenFromAuth();
        if (!token) throw new Error('OneDrive token missing.');
        if (fileId) await oneDrive.updateFileContent(token, fileId, serialized, 'application/json');
        else await oneDrive.createProjectFile(token, saveFolderId, `${doc.meta?.title || 'composer'}.nmc`, serialized, 'application/json');
      } else {
        const token = googleDrive.getStoredToken();
        if (!token) throw new Error('Google token missing.');
        if (fileId) await googleDrive.updateProjectFile(token, fileId, serialized);
        else await googleDrive.createFileInFolder(token, saveFolderId, `${doc.meta?.title || 'composer'}.nmc`, serialized);
      }
      setFeedback('Saved to cloud.');
    } catch (e) {
      setFeedback(e?.message || 'Cloud save failed.');
    } finally {
      setBusyMessage('');
    }
  }, [doc, searchParams]);

  useEffect(() => {
    if (!searchParams.get('fileId')) return;
    loadFromQueryFile();
  }, [searchParams, loadFromQueryFile]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') {
        if (!activeBlockId) return;
        e.preventDefault();
        deleteActiveBlock();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeBlockId, deleteActiveBlock]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      <header className="sticky top-0 z-20 border-b border-amber-200/60 dark:border-white/20 bg-white/80 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-[1500px] mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center"><AppLogo variant="header" alt="NoodiMeister" /></Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={loadFromQueryFile} className="px-3 py-2 rounded-lg border border-amber-300 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10">
              Lae query fail
            </button>
            <button type="button" onClick={saveLocal} className="px-3 py-2 rounded-lg border border-amber-300 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10">
              Salvesta .nmc
            </button>
            <button type="button" onClick={() => saveCloud('google')} className="px-3 py-2 rounded-lg border border-amber-300 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10">
              Salvesta Google
            </button>
            <button type="button" onClick={() => saveCloud('onedrive')} className="px-3 py-2 rounded-lg border border-amber-300 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10">
              Salvesta OneDrive
            </button>
            <button type="button" onClick={() => exportComposerToPdf(doc, `${doc.meta?.title || 'composer'}.pdf`)} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500">
              Export PDF
            </button>
            <button type="button" onClick={() => printComposerDocument(doc)} className="px-3 py-2 rounded-lg border border-amber-300 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10">
              Print
            </button>
          </div>
        </div>
      </header>

      <input ref={importProjectRef} type="file" accept=".nm,.noodimeister,.json" className="hidden" onChange={onProjectFileChange} />
      <input ref={importComposerRef} type="file" accept=".nmc,.json" className="hidden" onChange={onComposerFileChange} />

      <main className="max-w-[1500px] mx-auto p-4 grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_280px] gap-4">
        <ComposerSidebar
          blocks={activePage?.blocks || []}
          activeBlockId={activeBlockId}
          onUploadProject={handleUploadProject}
          onUploadComposer={handleUploadComposer}
          onAddText={addText}
          onAddPage={addPage}
          onSelectBlock={setActiveBlockId}
          toolMode={toolMode}
          onToolModeChange={setToolMode}
        />
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 pr-28 relative">
            {(doc.pages || []).map((page, idx) => (
              <button
                key={page.id}
                type="button"
                onClick={() => switchPage(page.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain');
                  if (!id) return;
                  moveBlockToPage(id, page.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm border ${page.id === doc.activePageId ? 'bg-amber-600 text-white border-amber-700' : 'bg-white dark:bg-zinc-900 text-amber-800 dark:text-white border-amber-200 dark:border-white/20'}`}
              >
                Leht {idx + 1}
              </button>
            ))}
            <div className="absolute right-0 top-0 inline-flex items-center gap-2">
              <button
                type="button"
                onClick={removeCurrentPage}
                className="w-8 h-8 rounded-lg border border-amber-300 dark:border-white/30 bg-white dark:bg-zinc-900 text-amber-900 dark:text-white font-bold hover:bg-amber-100 dark:hover:bg-white/10"
                title="Eemalda aktiivne leht"
              >
                -
              </button>
              <button
                type="button"
                onClick={addPage}
                className="w-8 h-8 rounded-lg border border-amber-300 dark:border-white/30 bg-white dark:bg-zinc-900 text-amber-900 dark:text-white font-bold hover:bg-amber-100 dark:hover:bg-white/10"
                title="Lisa uus leht"
              >
                +
              </button>
            </div>
          </div>
          <ComposerCanvas
            page={activePage}
            activeBlockId={activeBlockId}
            onSelectBlock={setActiveBlockId}
            onPatchBlock={patchBlock}
            grid={doc.grid}
            toolMode={toolMode}
            onSplitBlock={splitBlockByScissor}
          />
          {(busyMessage || feedback) && (
            <p className="text-sm text-amber-800 dark:text-white/90">{busyMessage || feedback}</p>
          )}
        </div>
        <ComposerInspector
          activeBlock={activeBlock}
          onPatchBlock={patchActiveBlock}
          onDeleteBlock={deleteActiveBlock}
        />
      </main>
    </div>
  );
}
