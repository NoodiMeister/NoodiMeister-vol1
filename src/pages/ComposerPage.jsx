import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppLogo } from '../components/AppLogo';
import ComposerSidebar from '../components/composer/ComposerSidebar';
import ComposerCanvas from '../components/composer/ComposerCanvas';
import ComposerInspector from '../components/composer/ComposerInspector';
import ComposerWritingToolbar from '../components/composer/ComposerWritingToolbar';
import ComposerFileInfoDialog from '../components/composer/ComposerFileInfoDialog';
import ComposerImportTimeline from '../components/composer/ComposerImportTimeline';
import {
  createComposerImportTimeline,
  advanceComposerImportTimeline,
  finishComposerImportTimeline,
  NOTATION_RENDER_WAIT_HINTS,
} from '../utils/composerImportTimeline';
import {
  applyPageOrientation,
  buildComposerFileName,
  COMPOSER_LAYER_BACKGROUND,
  composerPageHasTextBlocks,
  createComposerDocument,
  createComposerPage,
  createComposerBlockFromSvg,
  createComposerTextBox,
  getPageOrientation,
  isComposerDocumentJson,
  normalizeComposerDocument,
  parseComposerFileTitle,
  splitComposerBlock,
  touchMeta,
} from '../document/composerDocumentModel';
import { createComposerSvgBlocksFromProjectJson } from '../utils/composerSvgBlocks';
import { placeImportedBlocksOnPages } from '../utils/composerImportPlacement';
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

function cloudProviderFromParams(searchParams) {
  return searchParams.get('cloud') === 'onedrive' ? 'onedrive' : 'google';
}

function buildOpenedCloudFromParams(searchParams) {
  const fileId = searchParams.get('fileId');
  if (!fileId) return null;
  return {
    provider: cloudProviderFromParams(searchParams),
    fileId,
    fileName: '',
    folderId: searchParams.get('saveFolderId') || 'root',
  };
}

export default function ComposerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [doc, setDoc] = useState(() => createComposerDocument());
  const [openedCloudFile, setOpenedCloudFile] = useState(() => buildOpenedCloudFromParams(searchParams));
  const [activeBlockId, setActiveBlockId] = useState('');
  const [editingBlockId, setEditingBlockId] = useState('');
  const [pendingTextStyle, setPendingTextStyle] = useState('body');
  const [busyMessage, setBusyMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const [toolMode, setToolMode] = useState('text');
  const [fileInfoOpen, setFileInfoOpen] = useState(false);
  const [fileInfoTitle, setFileInfoTitle] = useState('');
  const [fileInfoProvider, setFileInfoProvider] = useState('google');
  const [fileInfoFolderId, setFileInfoFolderId] = useState('root');
  const [fileInfoError, setFileInfoError] = useState('');
  const [fileInfoBusy, setFileInfoBusy] = useState(false);
  const [importTimeline, setImportTimeline] = useState(null);
  const importProjectRef = useRef(null);
  const importComposerRef = useRef(null);
  const loadedFileIdRef = useRef('');
  const renderHintIndexRef = useRef(0);

  const dismissImportTimeline = useCallback(() => {
    setImportTimeline(null);
  }, []);

  const beginImport = useCallback((type, stepsOverride) => {
    renderHintIndexRef.current = 0;
    setImportTimeline(createComposerImportTimeline(type, stepsOverride));
  }, []);

  const advanceImport = useCallback((stepIndex, detail = '') => {
    setImportTimeline((prev) => advanceComposerImportTimeline(prev, stepIndex, detail));
  }, []);

  const finishImport = useCallback((ok, detail = '') => {
    setImportTimeline((prev) => finishComposerImportTimeline(prev, ok, detail));
  }, []);

  useEffect(() => {
    if (!importTimeline || importTimeline.status !== 'running') return;
    if (importTimeline.type !== 'notation' && importTimeline.type !== 'cloudNotation') return;
    if (importTimeline.current < 3) return;
    const timer = setInterval(() => {
      renderHintIndexRef.current = (renderHintIndexRef.current + 1) % NOTATION_RENDER_WAIT_HINTS.length;
      setImportTimeline((prev) => {
        if (!prev || prev.status !== 'running' || prev.current < 3) return prev;
        return { ...prev, detail: NOTATION_RENDER_WAIT_HINTS[renderHintIndexRef.current] };
      });
    }, 2800);
    return () => clearInterval(timer);
  }, [importTimeline]);

  const activePage = useMemo(() => doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0], [doc]);
  const activeBlock = useMemo(
    () => (activePage?.blocks || []).find((b) => b.id === activeBlockId) || null,
    [activePage, activeBlockId]
  );
  const pageOrientation = useMemo(() => getPageOrientation(activePage), [activePage]);
  const saveFolderId = searchParams.get('saveFolderId') || openedCloudFile?.folderId || 'root';
  const preferredCloud = openedCloudFile?.provider || cloudProviderFromParams(searchParams);
  const hasGoogle = !!googleDrive.getStoredToken();
  const hasMicrosoft = !!authStorage.getStoredMicrosoftTokenFromAuth();

  const syncUrlWithCloudFile = useCallback((file, { replace = true } = {}) => {
    const next = new URLSearchParams(searchParams);
    next.set('fileId', file.fileId);
    next.set('cloud', file.provider);
    next.delete('new');
    const folder = file.folderId || 'root';
    if (folder && folder !== 'root') next.set('saveFolderId', folder);
    else next.delete('saveFolderId');
    setSearchParams(next, { replace });
    setOpenedCloudFile(file);
  }, [searchParams, setSearchParams]);

  const startNewDocument = useCallback(() => {
    setDoc(createComposerDocument());
    setActiveBlockId('');
    setEditingBlockId('');
    setOpenedCloudFile(null);
    loadedFileIdRef.current = '';
    const next = new URLSearchParams(searchParams);
    next.delete('fileId');
    next.set('new', '1');
    setSearchParams(next, { replace: true });
    setFeedback('Uus kujundus.');
  }, [searchParams, setSearchParams]);

  const setPage = useCallback((patcher) => {
    setDoc((prev) => {
      const nextPages = prev.pages.map((page) => {
        if (page.id !== prev.activePageId) return page;
        return typeof patcher === 'function' ? patcher(page) : { ...page, ...patcher };
      });
      return touchMeta({ ...prev, pages: nextPages });
    });
  }, []);

  const setDocTitle = useCallback((title) => {
    setDoc((prev) => touchMeta({
      ...prev,
      meta: { ...(prev.meta || {}), title: title || 'Nimetu kujundus' },
    }));
  }, []);

  const applyComposerDocument = useCallback((nextDoc, sourceLabel) => {
    setDoc(normalizeComposerDocument(nextDoc));
    setActiveBlockId('');
    setEditingBlockId('');
    setFeedback(sourceLabel || 'Kujundus avatud.');
  }, []);

  const addProjectJsonAsBlock = useCallback(async (raw, sourceName, { timelineType = 'notation', manageTimeline = true } = {}) => {
    if (manageTimeline) beginImport(timelineType);
    try {
      const result = await createComposerSvgBlocksFromProjectJson(raw, sourceName, {
        onProgress: (step, detail) => advanceImport(step, detail),
        onPipeline: (pipe) => {
          if (pipe === 'fallback' && manageTimeline) {
            beginImport('notationFallback');
            advanceImport(2, 'Kasutan lihtsustatud eelvaadet…');
          }
        },
      });
      const blockSeeds = result.blocks || [];
      if (!blockSeeds.length) throw new Error('Render ei tagastanud ühtegi lehte.');
      const isFallback = result.pipeline === 'fallback';
      const placeStep = isFallback ? 3 : 5;
      const doneStep = isFallback ? 4 : 6;
      advanceImport(placeStep, 'Paigutan leheküljed kujundusse…');
      let placementSummary = '';
      let lastPlacedBlockId = '';
      setDoc((prev) => {
        const orientation = getPageOrientation(
          prev.pages.find((p) => p.id === prev.activePageId) || prev.pages[0],
        );
        const placement = placeImportedBlocksOnPages(
          prev.pages,
          blockSeeds,
          () => createComposerPage(orientation),
          (seed) => createComposerBlockFromSvg({
            name: seed.name,
            svgMarkup: seed.svgMarkup,
            width: seed.width,
            height: seed.height,
            source: {
              sourceName,
              sourceWidth: seed.sourceWidth,
              sourceHeight: seed.sourceHeight,
              renderPipeline: result.pipeline || 'notation-capture',
            },
          }),
        );
        const pageCount = blockSeeds.length;
        const startPage = placement.startPageIndex >= 0 ? placement.startPageIndex + 1 : 1;
        placementSummary = pageCount > 1
          ? `${pageCount} lehte lisati (alates lehelt ${startPage}).`
          : `Noodid lisati lehele ${startPage}.`;
        lastPlacedBlockId = placement.placedBlockIds[placement.placedBlockIds.length - 1] || '';
        return touchMeta({
          ...prev,
          pages: placement.pages,
          activePageId: placement.activePageId,
        });
      });
      setActiveBlockId(lastPlacedBlockId);
      setToolMode('move');
      advanceImport(doneStep);
      const successDetail = `"${sourceName}" — ${placementSummary} Vajuta Edasi, et vaadata tulemust.`;
      if (manageTimeline) finishImport(true, successDetail);
      setFeedback(blockSeeds.length > 1
        ? `Noodiprojekt "${sourceName}" lisati ${blockSeeds.length} lehena.`
        : `Noodiprojekt "${sourceName}" lisati plokina.`);
      return { successDetail, pageCount: blockSeeds.length };
    } catch (e) {
      if (manageTimeline) finishImport(false, e?.message || 'Import ebaõnnestus.');
      setFeedback(e?.message || 'Noodiprojekti import ebaõnnestus.');
      throw e;
    }
  }, [advanceImport, beginImport, finishImport]);

  const handleUploadProject = useCallback(() => importProjectRef.current?.click(), []);
  const handleUploadComposer = useCallback(() => importComposerRef.current?.click(), []);

  const onProjectFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    beginImport('notation');
    advanceImport(0, file.name);
    const raw = await file.text();
    try {
      JSON.parse(raw);
    } catch {
      finishImport(false, 'Fail ei ole kehtiv JSON.');
      setFeedback('Ei saanud noodiprojekti lugeda — fail ei ole kehtiv JSON.');
      return;
    }
    try {
      const { successDetail } = await addProjectJsonAsBlock(raw, file.name || 'Project', { timelineType: 'notation', manageTimeline: false });
      finishImport(true, successDetail);
    } catch {
      /* veateade juba seatud */
    }
  }, [addProjectJsonAsBlock, advanceImport, beginImport, finishImport]);

  const onComposerFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    beginImport('composerDoc');
    advanceImport(0, file.name);
    const raw = await file.text();
    advanceImport(1);
    try {
      applyComposerDocument(JSON.parse(raw), `Fail "${file.name}" avatud.`);
      setOpenedCloudFile(null);
      loadedFileIdRef.current = '';
      const next = new URLSearchParams(searchParams);
      next.delete('fileId');
      next.delete('new');
      setSearchParams(next, { replace: true });
      advanceImport(2);
      finishImport(true, `Fail "${file.name}" avatud. Vajuta Edasi, et vaadata kujundust.`);
    } catch {
      finishImport(false, 'Ei saanud .nmc faili lugeda.');
      setFeedback('Ei saanud .nmc faili lugeda.');
    }
  }, [applyComposerDocument, advanceImport, beginImport, finishImport, searchParams, setSearchParams]);

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
    setEditingBlockId('');
  }, [activeBlockId, setPage]);

  const addTextBlock = useCallback((presetKey = 'body', position = {}) => {
    const block = createComposerTextBox('', presetKey, position);
    setPage((page) => ({ ...page, blocks: [...page.blocks, block] }));
    setActiveBlockId(block.id);
    setEditingBlockId(block.id);
    setToolMode('text');
    return block.id;
  }, [setPage]);

  const addTextAt = useCallback((x, y, presetKey) => {
    addTextBlock(presetKey || pendingTextStyle || 'body', { x, y });
  }, [addTextBlock, pendingTextStyle]);

  const addTextPreset = useCallback((presetKey) => {
    const y = 48 + (activePage?.blocks || []).filter((b) => b.type === 'text').length * 48;
    addTextBlock(presetKey, { x: 36, y: Math.min(y, (activePage?.height || 1123) - 120) });
  }, [addTextBlock, activePage]);

  const addPage = useCallback(() => {
    const page = createComposerPage(pageOrientation);
    setDoc((prev) => touchMeta({ ...prev, pages: [...prev.pages, page], activePageId: page.id }));
    setActiveBlockId('');
    setEditingBlockId('');
  }, [pageOrientation]);

  const removeCurrentPage = useCallback(() => {
    setDoc((prev) => {
      if ((prev.pages || []).length <= 1) return prev;
      const idx = prev.pages.findIndex((p) => p.id === prev.activePageId);
      const nextPages = prev.pages.filter((p) => p.id !== prev.activePageId);
      const nextActive = nextPages[Math.max(0, Math.min(nextPages.length - 1, idx - 1))]?.id || nextPages[0]?.id;
      return touchMeta({ ...prev, pages: nextPages, activePageId: nextActive });
    });
    setActiveBlockId('');
    setEditingBlockId('');
  }, []);

  const switchPage = useCallback((id) => {
    setDoc((prev) => ({ ...prev, activePageId: id }));
    setActiveBlockId('');
    setEditingBlockId('');
  }, []);

  const setPageOrientation = useCallback((orientation) => {
    setPage((page) => applyPageOrientation(page, orientation));
  }, [setPage]);

  const moveBlockToPage = useCallback((blockId, targetPageId) => {
    let movedToTextPage = false;
    setDoc((prev) => {
      const sourcePage = prev.pages.find((p) => p.blocks.some((b) => b.id === blockId));
      const targetPage = prev.pages.find((p) => p.id === targetPageId);
      if (!sourcePage || !targetPage) return prev;
      const block = sourcePage.blocks.find((b) => b.id === blockId);
      if (!block) return prev;
      let nextBlock = { ...block, x: 28, y: 28 };
      if (block.type === 'svg' && composerPageHasTextBlocks(targetPage)) {
        nextBlock = { ...nextBlock, layer: COMPOSER_LAYER_BACKGROUND };
        movedToTextPage = true;
      }
      const nextPages = prev.pages.map((p) => {
        if (p.id === sourcePage.id) return { ...p, blocks: p.blocks.filter((b) => b.id !== blockId) };
        if (p.id === targetPage.id) return { ...p, blocks: [...p.blocks, nextBlock] };
        return p;
      });
      return touchMeta({ ...prev, pages: nextPages, activePageId: targetPageId });
    });
    setActiveBlockId(blockId);
    if (movedToTextPage) {
      setFeedback('SVG plokk paigutati taustakihti, et tekst jääks loetavaks.');
    }
  }, []);

  const splitBlockByScissor = useCallback((blockId, orientation, ratio) => {
    setPage((page) => {
      const block = page.blocks.find((b) => b.id === blockId);
      if (!block) return page;
      const parts = splitComposerBlock(block, orientation, ratio).map((part) => (
        composerPageHasTextBlocks(page)
          ? { ...part, layer: COMPOSER_LAYER_BACKGROUND }
          : part
      ));
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
    downloadText(buildComposerFileName(doc.meta?.title), JSON.stringify(doc, null, 2));
    setFeedback('Salvestatud arvutisse (.nmc).');
  }, [doc]);

  const loadCloudFile = useCallback(async (fileId, provider) => {
    if (!fileId) return;
    beginImport('cloudComposer');
    advanceImport(0, provider === 'onedrive' ? 'OneDrive' : 'Google Drive');
    try {
      let raw = '';
      let fileName = '';
      let folderId = 'root';
      if (provider === 'onedrive') {
        const token = authStorage.getStoredMicrosoftTokenFromAuth();
        if (!token) throw new Error('OneDrive sessioon puudub. Logi sisse Minu tööd lehel.');
        raw = await oneDrive.getFileContent(token, fileId);
        const meta = await oneDrive.getFileMetadata?.(token, fileId).catch(() => null);
        fileName = meta?.name || '';
        folderId = meta?.parentId || 'root';
      } else {
        const token = googleDrive.getStoredToken();
        if (!token) throw new Error('Google Drive sessioon puudub. Logi sisse Minu tööd lehel.');
        raw = await googleDrive.getFileContent(token, fileId);
        const meta = await googleDrive.getFileMetadata(token, fileId).catch(() => null);
        fileName = meta?.name || '';
        folderId = meta?.parents?.[0] || 'root';
      }
      advanceImport(1, fileName || fileId);

      if (isComposerDocumentJson(raw)) {
        const parsed = JSON.parse(raw);
        const titleFromFile = parseComposerFileTitle(fileName);
        if (titleFromFile && (!parsed.meta?.title || parsed.meta.title === 'Nimetu kujundus')) {
          parsed.meta = { ...(parsed.meta || {}), title: titleFromFile };
        }
        applyComposerDocument(parsed, 'Kujundus laaditud pilvest.');
        const cloudFile = { provider, fileId, fileName, folderId };
        setOpenedCloudFile(cloudFile);
        syncUrlWithCloudFile(cloudFile);
        loadedFileIdRef.current = fileId;
        advanceImport(2);
        advanceImport(3);
        finishImport(true, `"${fileName || 'Kujundus'}" laaditud pilvest. Vajuta Edasi, et vaadata.`);
      } else {
        beginImport('cloudNotation');
        advanceImport(2, fileName || 'Noodiprojekt');
        const { successDetail } = await addProjectJsonAsBlock(raw, fileName || `${provider}:${fileId}`, {
          timelineType: 'cloudNotation',
          manageTimeline: false,
        });
        setOpenedCloudFile(null);
        loadedFileIdRef.current = '';
        finishImport(true, successDetail);
      }
    } catch (e) {
      finishImport(false, e?.message || 'Pilvest laadimine ebaõnnestus.');
      setFeedback(e?.message || 'Pilvest laadimine ebaõnnestus.');
    }
  }, [addProjectJsonAsBlock, advanceImport, applyComposerDocument, beginImport, finishImport, syncUrlWithCloudFile]);

  const saveToCloud = useCallback(async (providerOverride) => {
    const provider = providerOverride || preferredCloud;
    const serialized = JSON.stringify(touchMeta(doc));
    const fileName = buildComposerFileName(doc.meta?.title);
    const existingFileId = (openedCloudFile?.provider === provider && openedCloudFile.fileId)
      || (cloudProviderFromParams(searchParams) === provider ? searchParams.get('fileId') : null);

    try {
      setBusyMessage(existingFileId ? 'Uuendan pilvefaili…' : 'Loon uue pilvefaili…');
      if (provider === 'onedrive') {
        const token = authStorage.getStoredMicrosoftTokenFromAuth();
        if (!token) throw new Error('OneDrive sessioon puudub. Logi sisse Minu tööd lehel.');
        if (existingFileId) {
          await oneDrive.updateFileContent(token, existingFileId, serialized, 'application/json');
          syncUrlWithCloudFile({ provider, fileId: existingFileId, fileName, folderId: saveFolderId });
          loadedFileIdRef.current = existingFileId;
        } else {
          const created = await oneDrive.createProjectFile(token, saveFolderId, fileName, serialized, 'application/json');
          const fileId = created?.id;
          if (!fileId) throw new Error('OneDrive ei tagastanud faili ID-d.');
          syncUrlWithCloudFile({ provider, fileId, fileName, folderId: saveFolderId });
          loadedFileIdRef.current = fileId;
        }
      } else {
        const token = googleDrive.getStoredToken();
        if (!token) throw new Error('Google Drive sessioon puudub. Logi sisse Minu tööd lehel.');
        if (existingFileId) {
          await googleDrive.updateProjectFile(token, existingFileId, serialized);
          syncUrlWithCloudFile({ provider: 'google', fileId: existingFileId, fileName, folderId: saveFolderId });
          loadedFileIdRef.current = existingFileId;
        } else {
          const fileId = await googleDrive.createFileInFolder(token, saveFolderId, fileName, serialized);
          syncUrlWithCloudFile({ provider: 'google', fileId, fileName, folderId: saveFolderId });
          loadedFileIdRef.current = fileId;
        }
      }
      setFeedback(existingFileId ? 'Kujundus uuendatud samas pilvefailis.' : 'Uus kujundus salvestatud pilve.');
    } catch (e) {
      setFeedback(e?.message || 'Pilve salvestamine ebaõnnestus.');
    } finally {
      setBusyMessage('');
    }
  }, [doc, openedCloudFile, preferredCloud, saveFolderId, searchParams, syncUrlWithCloudFile]);

  const openFileInfo = useCallback(async () => {
    const title = doc.meta?.title || parseComposerFileTitle(openedCloudFile?.fileName) || 'Nimetu kujundus';
    const provider = openedCloudFile?.provider || preferredCloud;
    let folderId = openedCloudFile?.folderId || saveFolderId || 'root';

    if (openedCloudFile?.fileId) {
      try {
        if (provider === 'onedrive') {
          const token = authStorage.getStoredMicrosoftTokenFromAuth();
          if (token) {
            const meta = await oneDrive.getFileMetadata(token, openedCloudFile.fileId);
            folderId = meta?.parentId || folderId;
          }
        } else {
          const token = googleDrive.getStoredToken();
          if (token) {
            const meta = await googleDrive.getFileMetadata(token, openedCloudFile.fileId);
            folderId = meta?.parents?.[0] || folderId;
          }
        }
      } catch {
        /* jäta olemasolev kaust */
      }
    }

    setFileInfoTitle(title);
    setFileInfoProvider(provider);
    setFileInfoFolderId(folderId);
    setFileInfoError('');
    setFileInfoOpen(true);
  }, [doc.meta?.title, openedCloudFile, preferredCloud, saveFolderId]);

  const applyFileInfo = useCallback(async () => {
    const title = fileInfoTitle.trim() || 'Nimetu kujundus';
    const fileName = buildComposerFileName(title);
    const provider = openedCloudFile?.fileId ? openedCloudFile.provider : fileInfoProvider;
    const folderId = fileInfoFolderId || 'root';
    const serialized = JSON.stringify(touchMeta({
      ...doc,
      meta: { ...(doc.meta || {}), title },
    }));

    setFileInfoBusy(true);
    setFileInfoError('');
    setFileInfoOpen(false);
    beginImport('fileInfo');

    try {
      advanceImport(0);
      setDocTitle(title);

      const fileId = openedCloudFile?.fileId;
      if (fileId) {
        advanceImport(1);
        if (provider === 'onedrive') {
          const token = authStorage.getStoredMicrosoftTokenFromAuth();
          if (!token) throw new Error('OneDrive sessioon puudub. Logi sisse Minu tööd lehel.');
          const currentMeta = await oneDrive.getFileMetadata(token, fileId);
          if (currentMeta.name !== fileName) {
            const renamed = await oneDrive.renameItem(token, fileId, fileName);
            if (!renamed.ok) throw new Error(renamed.error || 'Faili ümbernimetamine ebaõnnestus.');
          }
          const currentParent = currentMeta.parentId || 'root';
          if (folderId && currentParent !== folderId) {
            const moved = await oneDrive.moveItem(token, fileId, folderId);
            if (!moved.ok) throw new Error(moved.error || 'Faili teisaldamine ebaõnnestus.');
          }
          await oneDrive.updateFileContent(token, fileId, serialized, 'application/json');
        } else {
          const token = googleDrive.getStoredToken();
          if (!token) throw new Error('Google Drive sessioon puudub. Logi sisse Minu tööd lehel.');
          const currentMeta = await googleDrive.getFileMetadata(token, fileId);
          if (currentMeta.name !== fileName) {
            await googleDrive.renameFolder(token, fileId, fileName);
          }
          const currentParent = currentMeta.parents?.[0] || 'root';
          if (folderId && currentParent !== folderId) {
            await googleDrive.moveFolder(token, fileId, folderId);
          }
          await googleDrive.updateProjectFile(token, fileId, serialized);
        }
        advanceImport(2, 'Salvestan pilve…');
        syncUrlWithCloudFile({ provider, fileId, fileName, folderId });
        loadedFileIdRef.current = fileId;
        advanceImport(3);
        finishImport(true, 'Faili andmed ja sisu salvestatud pilve. Vajuta Edasi.');
        setFeedback('Faili andmed ja sisu salvestatud pilve.');
      } else {
        advanceImport(1);
        const next = new URLSearchParams(searchParams);
        next.set('cloud', fileInfoProvider);
        if (folderId && folderId !== 'root') next.set('saveFolderId', folderId);
        else next.delete('saveFolderId');
        setSearchParams(next, { replace: true });
        advanceImport(3);
        finishImport(true, 'Faili andmed uuendatud. Vajuta Edasi.');
        setFeedback('Faili andmed uuendatud. Järgmine pilve salvestus kasutab uut nime ja asukohta.');
      }
    } catch (e) {
      finishImport(false, e?.message || 'Faili andmete salvestamine ebaõnnestus.');
      setFileInfoError(e?.message || 'Faili andmete salvestamine ebaõnnestus.');
      setFileInfoOpen(true);
    } finally {
      setFileInfoBusy(false);
    }
  }, [
    doc,
    fileInfoFolderId,
    fileInfoProvider,
    fileInfoTitle,
    openedCloudFile,
    searchParams,
    setDocTitle,
    setSearchParams,
    syncUrlWithCloudFile,
    beginImport,
    advanceImport,
    finishImport,
  ]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && !searchParams.get('fileId')) {
      if (loadedFileIdRef.current) return;
      setDoc(createComposerDocument());
      setOpenedCloudFile(null);
      setActiveBlockId('');
      setEditingBlockId('');
      return;
    }
    const fileId = searchParams.get('fileId');
    if (!fileId || loadedFileIdRef.current === fileId) return;
    loadCloudFile(fileId, cloudProviderFromParams(searchParams));
  }, [searchParams, loadCloudFile]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (editingBlockId) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveToCloud();
        return;
      }
      if (e.key === 't' || e.key === 'T') {
        if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        e.preventDefault();
        setToolMode('text');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') {
        if (!activeBlockId) return;
        e.preventDefault();
        deleteActiveBlock();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeBlockId, deleteActiveBlock, editingBlockId, saveToCloud]);

  const showWritingToolbar = toolMode === 'text' || activeBlock?.type === 'text';
  const cloudSaveLabel = openedCloudFile?.fileId
    ? `Salvesta (${openedCloudFile.provider === 'onedrive' ? 'OneDrive' : 'Google'})`
    : `Salvesta pilve (${preferredCloud === 'onedrive' ? 'OneDrive' : 'Google'})`;
  const displayFileName = openedCloudFile?.fileName || buildComposerFileName(doc.meta?.title);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      <header className="sticky top-0 z-20 border-b border-amber-200/60 dark:border-white/20 bg-white/80 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-[1500px] mx-auto px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <Link to="/tood" className="flex items-center"><AppLogo variant="header" alt="NoodiMeister" /></Link>
              <div className="min-w-0">
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-200 block">Kujundaja</span>
                <span className="text-xs text-amber-700 dark:text-white/70 truncate block max-w-[240px]" title={displayFileName}>
                  {displayFileName}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={openFileInfo}
              className="px-3 py-2 rounded-lg border border-amber-300 dark:border-white/30 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10 whitespace-nowrap"
            >
              Faili andmed
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={startNewDocument} className="px-3 py-2 rounded-lg border border-amber-300 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10">
                Uus kujundus
              </button>
              <button type="button" onClick={saveLocal} className="px-3 py-2 rounded-lg border border-amber-300 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10">
                Salvesta arvutisse
              </button>
              <button type="button" onClick={() => saveToCloud()} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500" title="Cmd/Ctrl+S">
                {cloudSaveLabel}
              </button>
              <button type="button" onClick={() => exportComposerToPdf(doc, `${buildComposerFileName(doc.meta?.title).replace(/\.nmc$/i, '')}.pdf`)} className="px-3 py-2 rounded-lg border border-amber-300 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10">
                Export PDF
              </button>
              <button type="button" onClick={() => printComposerDocument(doc)} className="px-3 py-2 rounded-lg border border-amber-300 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10">
                Print
              </button>
            </div>
          </div>
          {openedCloudFile?.fileId && (
            <p className="text-xs text-amber-700 dark:text-white/70">
              Avatud pilvefail: {openedCloudFile.fileName || openedCloudFile.fileId}
              {' · '}
              Järgmine salvestus uuendab sama faili (ei loo duplikaati).
            </p>
          )}
          {showWritingToolbar && (
            <ComposerWritingToolbar
              activeBlock={activeBlock?.type === 'text' ? activeBlock : null}
              pendingTextStyle={pendingTextStyle}
              onPendingTextStyleChange={setPendingTextStyle}
              onPatchBlock={patchActiveBlock}
            />
          )}
        </div>
      </header>

      <input ref={importProjectRef} type="file" accept=".nm,.noodimeister,.json" className="hidden" onChange={onProjectFileChange} />
      <input ref={importComposerRef} type="file" accept=".nmc,.json" className="hidden" onChange={onComposerFileChange} />

      <main className="max-w-[1500px] mx-auto p-4 grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_280px] gap-4">
        <ComposerSidebar
          blocks={activePage?.blocks || []}
          activeBlockId={activeBlockId}
          activeBlock={activeBlock}
          onBlockLayerChange={(layer) => patchActiveBlock({ layer })}
          onUploadProject={handleUploadProject}
          onUploadComposer={handleUploadComposer}
          onAddTextPreset={addTextPreset}
          onAddPage={addPage}
          onSelectBlock={(id) => {
            setActiveBlockId(id);
            const block = (activePage?.blocks || []).find((b) => b.id === id);
            if (block?.type === 'text') setToolMode('text');
          }}
          toolMode={toolMode}
          onToolModeChange={setToolMode}
          pageOrientation={pageOrientation}
          onPageOrientationChange={setPageOrientation}
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
            editingBlockId={editingBlockId}
            onSelectBlock={setActiveBlockId}
            onPatchBlock={patchBlock}
            onStartEdit={setEditingBlockId}
            onEndEdit={() => setEditingBlockId('')}
            grid={doc.grid}
            toolMode={toolMode}
            onSplitBlock={splitBlockByScissor}
            onAddTextAt={addTextAt}
            pendingTextStyle={pendingTextStyle}
          />
          {(busyMessage || feedback) && !importTimeline && (
            <p className="text-sm text-amber-800 dark:text-white/90">{busyMessage || feedback}</p>
          )}
        </div>
        <ComposerInspector
          activeBlock={activeBlock}
          onPatchBlock={patchActiveBlock}
          onDeleteBlock={deleteActiveBlock}
        />
      </main>

      <ComposerFileInfoDialog
        open={fileInfoOpen}
        onClose={() => { if (!fileInfoBusy && !importTimeline) setFileInfoOpen(false); }}
        title={fileInfoTitle}
        onTitleChange={setFileInfoTitle}
        provider={fileInfoProvider}
        onProviderChange={setFileInfoProvider}
        folderId={fileInfoFolderId}
        onFolderChange={(id) => setFileInfoFolderId(id)}
        hasGoogle={hasGoogle}
        hasMicrosoft={hasMicrosoft}
        fileLockedProvider={openedCloudFile?.fileId ? openedCloudFile.provider : null}
        onApply={applyFileInfo}
        busy={fileInfoBusy || (importTimeline?.type === 'fileInfo' && importTimeline?.status === 'running')}
        error={fileInfoError}
      />

      <ComposerImportTimeline timeline={importTimeline} onDismiss={dismissImportTimeline} />
    </div>
  );
}
