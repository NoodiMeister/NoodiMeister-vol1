/**
 * Muusika stuudio · Montaaž
 * ZERO notation-editor tools. Import score → audio/video → sync → scenes → playhead.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppLogo } from '../components/AppLogo';
import {
  CURSOR_MOTION_ARC,
  CURSOR_MOTION_JUMP,
  CURSOR_MOTION_LINEAR,
  CURSOR_MOTION_TRIANGLE_JUMP,
  addSceneToDoc,
  addSyncPointToDoc,
  buildMusicStudioFileName,
  createMusicStudioDocument,
  importMusicXmlScore,
  importNoodimeisterScore,
  normalizeMusicStudioDocument,
  removeSceneFromDoc,
  removeSyncPointFromDoc,
  setDocStatus,
  setMediaAudioLocal,
  setPlaybackCursor,
  setVideoAsset,
  touchMusicStudioMeta,
  updateSceneInDoc,
} from '../document/musicStudioDocumentModel';
import * as googleDrive from '../services/googleDrive';
import { mediaSecToProgress, renderMontageVideo } from '../studio/montageVideoRender';
import {
  PLAYHEAD_QUANTIZE_GRIDS,
  estimateTotalBeatsFromDoc,
  quantizeProgress01,
} from '../studio/playheadQuantize';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, getTranslations } from '../i18n';

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function serializeStudioDoc(doc) {
  const cleaned = {
    ...touchMusicStudioMeta(doc),
    media: doc.media
      ? {
          ...doc.media,
          local: doc.media.local
            ? { ...doc.media.local, objectUrl: null }
            : null,
        }
      : null,
  };
  return JSON.stringify(cleaned, null, 2);
}

const MOTION_OPTIONS = [
  { id: CURSOR_MOTION_LINEAR, labelKey: 'studio.cursorLinear' },
  { id: CURSOR_MOTION_JUMP, labelKey: 'studio.cursorJump' },
  { id: CURSOR_MOTION_ARC, labelKey: 'studio.cursorArc' },
  { id: CURSOR_MOTION_TRIANGLE_JUMP, labelKey: 'studio.cursorTriangle' },
];

function downloadJson(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MusicStudioPage() {
  const [searchParams] = useSearchParams();
  const [locale] = useState(() => {
    try {
      return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  });
  const t = useMemo(() => getTranslations(locale), [locale]);
  const tr = useCallback((key, fallback) => t[key] || fallback, [t]);

  const isNew = searchParams.get('new') === '1';
  const [doc, setDoc] = useState(() =>
    normalizeMusicStudioDocument(
      createMusicStudioDocument({
        title: isNew ? tr('studio.newMontageTitle', 'Uus montaaž') : tr('studio.montage', 'Montaaž'),
      })
    )
  );
  const [feedback, setFeedback] = useState('');
  const [mediaTime, setMediaTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activePanel, setActivePanel] = useState('import'); // import | scenes | sync | cursor | export
  const [sceneNameDraft, setSceneNameDraft] = useState('1');
  const [syncMeasureDraft, setSyncMeasureDraft] = useState(0);
  const [busy, setBusy] = useState('');
  const [cloudFileId, setCloudFileId] = useState(() => searchParams.get('fileId') || '');
  const [saveFolderId] = useState(() => searchParams.get('saveFolderId') || 'root');
  const [presentationVideo, setPresentationVideo] = useState(null); // { blob, fileName, mimeType }
  const [renderProgress, setRenderProgress] = useState(null); // 0..1 or null
  const renderAbortRef = useRef(null);

  const nmInputRef = useRef(null);
  const xmlInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioRef = useRef(null);
  const objectUrlRef = useRef(null);

  const fileName = buildMusicStudioFileName(doc.title);
  const cursor = doc.playback?.cursor || {};
  const needsQuantize = cursor.motion === CURSOR_MOTION_JUMP || cursor.motion === CURSOR_MOTION_TRIANGLE_JUMP;
  const hasScore = !!(doc.score?.snapshot || doc.score?.musicXml);
  const mediaUrl = doc.media?.local?.objectUrl || null;

  useEffect(() => () => {
    if (objectUrlRef.current) {
      try { URL.revokeObjectURL(objectUrlRef.current); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const onTime = () => setMediaTime(el.currentTime || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [mediaUrl]);

  const patchDoc = useCallback((updater) => {
    setDoc((prev) => normalizeMusicStudioDocument(typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const onImportNm = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      patchDoc((prev) => importNoodimeisterScore(prev, json, { fileName: file.name }));
      setFeedback(tr('studio.importNmOk', 'Noodimeistri tööfail imporditud (rikas snapshot).'));
      setActivePanel('sync');
    } catch (err) {
      setFeedback(err?.message || tr('studio.importNmFail', 'Tööfaili lugemine ebaõnnestus.'));
    }
  };

  const onImportXml = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      if (!text.includes('<') || !/score-partwise|score-timewise/i.test(text)) {
        setFeedback(tr('studio.importXmlInvalid', 'See ei tundu olevat MusicXML fail.'));
        return;
      }
      patchDoc((prev) => importMusicXmlScore(prev, text, { fileName: file.name }));
      setFeedback(tr('studio.importXmlOk', 'MusicXML imporditud.'));
      setActivePanel('sync');
    } catch (err) {
      setFeedback(err?.message || tr('studio.importXmlFail', 'MusicXML lugemine ebaõnnestus.'));
    }
  };

  const onImportAudio = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (objectUrlRef.current) {
      try { URL.revokeObjectURL(objectUrlRef.current); } catch { /* ignore */ }
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    patchDoc((prev) => setMediaAudioLocal(prev, {
      fileName: file.name,
      mimeType: file.type || 'audio/*',
      objectUrl: url,
    }));
    setFeedback(tr('studio.importAudioOk', 'Helifail lisatud. Seadista sync ankruptid.'));
    setActivePanel('sync');
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  const seekTo = (sec) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, sec);
    setMediaTime(el.currentTime);
  };

  const addSyncAtPlayhead = () => {
    patchDoc((prev) => addSyncPointToDoc(prev, {
      measureIndex: Number(syncMeasureDraft) || 0,
      beatInMeasure: 0,
      mediaSec: mediaTime,
      source: 'manual',
    }));
  };

  const addScene = () => {
    const name = String(sceneNameDraft || '').trim() || String((doc.scenes?.length || 0) + 1);
    patchDoc((prev) => addSceneToDoc(prev, name));
    setSceneNameDraft(String((doc.scenes?.length || 0) + 2));
  };

  const saveLocal = () => {
    downloadJson(fileName, JSON.parse(serializeStudioDoc(doc)));
    setFeedback(tr('studio.savedLocal', 'Montaaž salvestatud arvutisse (.nms).'));
  };

  const saveToGoogleDrive = async () => {
    const token = googleDrive.getStoredToken();
    if (!token) {
      setFeedback(tr('studio.driveNeedLogin', 'Google Drive sessioon puudub. Logi sisse Minu tööd lehel.'));
      return;
    }
    const content = serializeStudioDoc(doc);
    try {
      setBusy(cloudFileId ? tr('studio.driveUpdating', 'Uuendan Drive’is…') : tr('studio.driveCreating', 'Salvestan Drive’i…'));
      if (cloudFileId) {
        await googleDrive.updateProjectFile(token, cloudFileId, content);
        setFeedback(tr('studio.driveUpdated', 'Poolik/valmis montaaž (.nms) uuendatud Google Drive’is.'));
      } else {
        const id = await googleDrive.createFileInFolder(token, saveFolderId || 'root', fileName, content);
        setCloudFileId(id);
        setFeedback(tr('studio.driveCreated', 'Montaaž (.nms) salvestatud Google Drive kausta — avatav Minu töödest.'));
      }
    } catch (err) {
      setFeedback(err?.message || tr('studio.driveFail', 'Drive’i salvestamine ebaõnnestus.'));
    } finally {
      setBusy('');
    }
  };

  const runMp4Render = async () => {
    if (!hasScore && !mediaUrl) {
      setFeedback(tr('studio.renderNeedContent', 'Renderiks vaja partituuri ja/või helifaili.'));
      return;
    }
    if (renderAbortRef.current) {
      try { renderAbortRef.current.abort(); } catch { /* ignore */ }
    }
    const ac = new AbortController();
    renderAbortRef.current = ac;
    const audioDur = audioRef.current?.duration && Number.isFinite(audioRef.current.duration)
      ? audioRef.current.duration
      : null;
    try {
      setBusy(tr('studio.rendering', 'Renderin videot…'));
      setRenderProgress(0);
      // Pause UI playback so captureStream gets a clean audio element
      try { audioRef.current?.pause?.(); } catch { /* ignore */ }
      const result = await renderMontageVideo({
        doc,
        audioUrl: mediaUrl,
        audioDurationSec: audioDur,
        width: 1280,
        height: 720,
        fps: 24,
        signal: ac.signal,
        onProgress: ({ ratio }) => setRenderProgress(ratio),
      });
      setPresentationVideo({
        blob: result.blob,
        fileName: result.fileName,
        mimeType: result.mimeType,
      });
      patchDoc((prev) => setDocStatus(prev, 'final'));
      setFeedback(
        result.ext === 'mp4'
          ? tr('studio.renderMp4Ok', 'MP4 render valmis — lae alla või kanna Drive’i.')
          : tr('studio.renderWebmOk', 'Video render valmis (WebM — brauser ei toeta MP4 MediaRecorder’it). Lae alla või kanna Drive’i.')
      );
      setActivePanel('export');
    } catch (err) {
      if (err?.name === 'AbortError') {
        setFeedback(tr('studio.renderCancelled', 'Render tühistatud.'));
      } else {
        setFeedback(err?.message || tr('studio.renderFail', 'Video render ebaõnnestus.'));
      }
    } finally {
      setBusy('');
      setRenderProgress(null);
      renderAbortRef.current = null;
    }
  };

  const cancelRender = () => {
    try { renderAbortRef.current?.abort(); } catch { /* ignore */ }
  };

  const onPickPresentationVideo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPresentationVideo({
      blob: file,
      fileName: file.name || `${(doc.title || 'montaaz').replace(/\s+/g, '-')}.mp4`,
      mimeType: file.type || 'video/mp4',
    });
    setFeedback(tr('studio.videoReady', 'Videofail valmis allalaadimiseks või Drive’i kandmiseks.'));
    setActivePanel('export');
  };

  const downloadPresentationVideo = () => {
    if (!presentationVideo?.blob) {
      setFeedback(tr('studio.videoMissing', 'Vali või laadi esmalt videofail (Export paneel).'));
      return;
    }
    downloadBlob(presentationVideo.fileName, presentationVideo.blob);
    setFeedback(tr('studio.videoDownloaded', 'Videofail alla laaditud — esitatav eraldiseisvana.'));
  };

  const uploadPresentationVideoToDrive = async () => {
    if (!presentationVideo?.blob) {
      setFeedback(tr('studio.videoMissing', 'Vali või laadi esmalt videofail (Export paneel).'));
      return;
    }
    const token = googleDrive.getStoredToken();
    if (!token) {
      setFeedback(tr('studio.driveNeedLogin', 'Google Drive sessioon puudub. Logi sisse Minu tööd lehel.'));
      return;
    }
    const folderId = saveFolderId || doc.videoAsset?.folderId || 'root';
    const videoName = presentationVideo.fileName || `${(doc.title || 'montaaz').replace(/\s+/g, '-')}.mp4`;
    try {
      setBusy(tr('studio.videoUploading', 'Kandin videot Drive’i…'));
      const fileId = await googleDrive.uploadBinaryFileInFolder(
        token,
        folderId,
        videoName,
        presentationVideo.blob,
        presentationVideo.mimeType || 'video/mp4'
      );
      patchDoc((prev) => setVideoAsset(setDocStatus(prev, 'final'), {
        provider: 'google',
        fileId,
        folderId,
        fileName: videoName,
        mimeType: presentationVideo.mimeType || 'video/mp4',
      }));
      // Also refresh .nms so Minu tööd sees on viide videole
      try {
        const nextDoc = setVideoAsset(setDocStatus(doc, 'final'), {
          provider: 'google',
          fileId,
          folderId,
          fileName: videoName,
          mimeType: presentationVideo.mimeType || 'video/mp4',
        });
        const content = serializeStudioDoc(nextDoc);
        if (cloudFileId) {
          await googleDrive.updateProjectFile(token, cloudFileId, content);
        } else {
          const id = await googleDrive.createFileInFolder(token, folderId, fileName, content);
          setCloudFileId(id);
        }
      } catch { /* video already uploaded; .nms sync best-effort */ }
      setFeedback(tr('studio.videoOnDrive', 'Video Drive’is (sama kaust). Esitatav eraldiseisvana; .nms viide uuendatud.'));
    } catch (err) {
      setFeedback(err?.message || tr('studio.videoUploadFail', 'Video Drive’i kandmine ebaõnnestus.'));
    } finally {
      setBusy('');
    }
  };

  const playheadStyle = (() => {
    const motion = cursor.motion || CURSOR_MOTION_LINEAR;
    if (motion === CURSOR_MOTION_ARC) return { transition: 'left 0.35s cubic-bezier(0.4,0,0.2,1)' };
    if (motion === CURSOR_MOTION_JUMP || motion === CURSOR_MOTION_TRIANGLE_JUMP) {
      return { transition: 'none' };
    }
    return { transition: 'left 0.12s linear' };
  })();

  const duration = audioRef.current?.duration && Number.isFinite(audioRef.current.duration)
    ? audioRef.current.duration
    : (doc.media?.local?.durationSec || 60);
  /** Live playhead: sync → progress; jump+quantize = rütmivõre floor-snap. */
  const playheadPct = (() => {
    if (!(duration > 0)) return 0;
    let progress = mediaSecToProgress(doc.sync?.points, mediaTime, duration);
    const jump = cursor.motion === CURSOR_MOTION_JUMP || cursor.motion === CURSOR_MOTION_TRIANGLE_JUMP;
    if (jump && cursor.quantize?.enabled) {
      progress = quantizeProgress01(progress, estimateTotalBeatsFromDoc(doc), cursor.quantize);
    } else if (!jump) {
      // linear/arc ruler: follow media time directly on the audio bar;
      // score overlay still uses sync progress when anchors exist
      progress = (doc.sync?.points || []).length
        ? progress
        : mediaTime / duration;
    }
    return Math.min(100, Math.max(0, progress * 100));
  })();

  const panelBtn = (id, label) => (
    <button
      key={id}
      type="button"
      onClick={() => setActivePanel(id)}
      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border ${
        activePanel === id
          ? 'bg-teal-700 text-white border-teal-800'
          : 'bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col">
      <header className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-white border-b border-zinc-200 shadow-sm">
        <Link to="/tood" className="flex items-center gap-2 no-underline text-zinc-800 hover:opacity-90" title={tr('mywork.title', 'Minu tööd')}>
          <AppLogo className="h-8 w-auto" />
        </Link>
        <div className="flex flex-col min-w-0 mr-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-teal-700">
            {tr('studio.brand', 'Muusika stuudio')}
          </span>
          <input
            className="text-sm font-semibold bg-transparent border-b border-transparent focus:border-teal-500 outline-none min-w-[8rem] max-w-[16rem]"
            value={doc.title || ''}
            onChange={(e) => patchDoc((prev) => ({ ...prev, title: e.target.value }))}
            aria-label={tr('studio.title', 'Pealkiri')}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {panelBtn('import', tr('studio.toolImport', 'Import'))}
          {panelBtn('scenes', tr('studio.toolScenes', 'Stseenid'))}
          {panelBtn('sync', tr('studio.toolSync', 'Sync'))}
          {panelBtn('cursor', tr('studio.toolCursor', 'Cursor'))}
          {panelBtn('export', tr('studio.toolExport', 'Video / Drive'))}
        </div>

        <span
          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
            doc.status === 'final'
              ? 'bg-teal-100 text-teal-900 border-teal-300'
              : 'bg-amber-50 text-amber-900 border-amber-300'
          }`}
          title={doc.status === 'final' ? tr('studio.statusFinal', 'Valmis') : tr('studio.statusDraft', 'Poolik')}
        >
          {doc.status === 'final' ? tr('studio.statusFinal', 'Valmis') : tr('studio.statusDraft', 'Poolik')}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {busy ? <span className="text-[11px] text-zinc-500">{busy}</span> : null}
          <button
            type="button"
            onClick={saveLocal}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-300 bg-white hover:bg-zinc-50"
          >
            {tr('studio.saveLocal', 'Lae .nms alla')}
          </button>
          <button
            type="button"
            onClick={saveToGoogleDrive}
            disabled={!!busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-teal-700 bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {tr('studio.saveDrive', 'Salvesta Drive’i')}
          </button>
          <Link
            to="/tood"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-300 bg-white hover:bg-zinc-50 no-underline text-zinc-800"
          >
            {tr('studio.backToMyWorks', 'Minu tööd')}
          </Link>
        </div>
      </header>

      {feedback ? (
        <div className="px-4 py-2 text-xs bg-teal-50 text-teal-900 border-b border-teal-100 flex justify-between gap-2">
          <span>{feedback}</span>
          <button type="button" className="font-semibold underline" onClick={() => setFeedback('')}>OK</button>
        </div>
      ) : null}

      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-900">
        {tr('studio.noNotationTools', 'Montaažis ei ole noodigraafika redaktori tööriistu — ainult import, stseenid, sync ja playhead.')}
      </div>

      {/* Tool drawer */}
      <div className="px-4 py-3 bg-white border-b border-zinc-200">
        {activePanel === 'import' && (
          <div className="flex flex-wrap gap-3 items-start">
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-zinc-700">{tr('studio.importScore', 'Partituur')}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => nmInputRef.current?.click()}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border border-teal-600 text-teal-800 bg-teal-50 hover:bg-teal-100"
                >
                  {tr('studio.importNm', 'Noodimeistri tööfail (.nm)')}
                </button>
                <button
                  type="button"
                  onClick={() => xmlInputRef.current?.click()}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border border-zinc-400 text-zinc-800 bg-zinc-50 hover:bg-zinc-100"
                >
                  {tr('studio.importXml', 'MusicXML arvutist')}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 max-w-md">
                {tr('studio.importScoreHint', 'Rikas .nm toob kogu sisu ja kujunduse. MusicXML sobib teistest programmidest.')}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-zinc-700">{tr('studio.importAudio', 'Helifail')}</p>
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-zinc-400 text-zinc-800 bg-zinc-50 hover:bg-zinc-100"
              >
                {tr('studio.importAudioBtn', 'Lae heli (MP3 / WAV…)')}
              </button>
            </div>
            <input ref={nmInputRef} type="file" accept=".nm,.json,application/json" className="hidden" onChange={onImportNm} />
            <input ref={xmlInputRef} type="file" accept=".xml,.musicxml,application/xml,text/xml" className="hidden" onChange={onImportXml} />
            <input ref={audioInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" className="hidden" onChange={onImportAudio} />
          </div>
        )}

        {activePanel === 'scenes' && (
          <div className="space-y-2 max-w-xl">
            <p className="text-xs text-zinc-600">
              {tr('studio.scenesHint', 'Stseenikastid kantakse video redaktorisse. Nimi võib olla number, täht või vaba tekst.')}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={sceneNameDraft}
                onChange={(e) => setSceneNameDraft(e.target.value)}
                placeholder="1 / A / Intro"
                className="px-2 py-1.5 rounded-md border border-zinc-300 text-xs w-40"
                aria-label={tr('studio.sceneName', 'Stseeni nimi')}
              />
              <button
                type="button"
                onClick={addScene}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-teal-700 text-white border border-teal-800"
              >
                {tr('studio.addScene', 'Lisa stseenikast')}
              </button>
            </div>
            <ul className="space-y-1.5">
              {(doc.scenes || []).map((scene) => (
                <li key={scene.id} className="flex flex-wrap items-center gap-2 text-xs bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1.5">
                  <input
                    value={scene.name}
                    onChange={(e) => patchDoc((prev) => updateSceneInDoc(prev, scene.id, { name: e.target.value }))}
                    className="px-1.5 py-0.5 rounded border border-zinc-300 font-semibold w-28"
                  />
                  <span className="text-zinc-500">{tr('studio.sceneStart', 'Algus')} {mediaTime.toFixed(1)}s</span>
                  <button
                    type="button"
                    className="underline text-teal-800"
                    onClick={() => patchDoc((prev) => updateSceneInDoc(prev, scene.id, { startSec: mediaTime }))}
                  >
                    {tr('studio.setSceneStart', 'Sea playhead’ile')}
                  </button>
                  <button
                    type="button"
                    className="ml-auto text-red-700 underline"
                    onClick={() => patchDoc((prev) => removeSceneFromDoc(prev, scene.id))}
                  >
                    {tr('studio.remove', 'Eemalda')}
                  </button>
                </li>
              ))}
              {(doc.scenes || []).length === 0 ? (
                <li className="text-[11px] text-zinc-500">{tr('studio.noScenes', 'Stseenikaste pole veel.')}</li>
              ) : null}
            </ul>
          </div>
        )}

        {activePanel === 'sync' && (
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs text-zinc-600">
              {tr('studio.syncHint', 'Soundslice-laadne sync: ankurda takti algus helifaili ajale. Seek töötab mõlemas suunas.')}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="text-xs flex items-center gap-1">
                {tr('studio.measureIndex', 'Takt (0-põhine)')}
                <input
                  type="number"
                  min={0}
                  value={syncMeasureDraft}
                  onChange={(e) => setSyncMeasureDraft(Number(e.target.value) || 0)}
                  className="w-16 px-1.5 py-1 rounded border border-zinc-300"
                />
              </label>
              <span className="text-xs text-zinc-500">t = {mediaTime.toFixed(2)}s</span>
              <button
                type="button"
                onClick={addSyncAtPlayhead}
                disabled={!mediaUrl}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-teal-700 text-white border border-teal-800 disabled:opacity-50"
              >
                {tr('studio.addSync', 'Lisa sync ankur')}
              </button>
            </div>
            <ul className="space-y-1">
              {(doc.sync?.points || []).map((p) => (
                <li key={p.id} className="flex flex-wrap gap-2 items-center text-xs bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1">
                  <span className="font-semibold">M{p.measureIndex}</span>
                  <span>→ {Number(p.mediaSec).toFixed(2)}s</span>
                  <button type="button" className="underline text-teal-800" onClick={() => seekTo(p.mediaSec)}>
                    {tr('studio.seek', 'Seek')}
                  </button>
                  <button
                    type="button"
                    className="ml-auto text-red-700 underline"
                    onClick={() => patchDoc((prev) => removeSyncPointFromDoc(prev, p.id))}
                  >
                    {tr('studio.remove', 'Eemalda')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activePanel === 'export' && (
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs text-zinc-600">
              {tr(
                'studio.exportHint',
                'Poolik montaaž (.nms) ja valmis videofail peavad olema Drive kaustast kätte saadavad. Video peab olema alla laetav ja eraldiseisvalt esitatav.'
              )}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => patchDoc((prev) => setDocStatus(prev, 'draft'))}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border ${
                  doc.status !== 'final' ? 'bg-amber-600 text-white border-amber-700' : 'bg-white border-zinc-300'
                }`}
              >
                {tr('studio.markDraft', 'Märgi poolikuks')}
              </button>
              <button
                type="button"
                onClick={() => patchDoc((prev) => setDocStatus(prev, 'final'))}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border ${
                  doc.status === 'final' ? 'bg-teal-700 text-white border-teal-800' : 'bg-white border-zinc-300'
                }`}
              >
                {tr('studio.markFinal', 'Märgi valmis')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={runMp4Render}
                disabled={!!busy}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-teal-800 bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {tr('studio.renderMp4', 'Renderi MP4 / video')}
              </button>
              {renderProgress != null ? (
                <>
                  <div className="h-2 w-40 rounded-full bg-zinc-200 overflow-hidden" title={`${Math.round(renderProgress * 100)}%`}>
                    <div className="h-full bg-teal-600 transition-all" style={{ width: `${Math.round(renderProgress * 100)}%` }} />
                  </div>
                  <button
                    type="button"
                    onClick={cancelRender}
                    className="px-2 py-1 rounded-md text-xs font-semibold border border-zinc-400 bg-white"
                  >
                    {tr('studio.cancelRender', 'Tühista')}
                  </button>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-zinc-400 bg-zinc-50 hover:bg-zinc-100"
              >
                {tr('studio.pickVideo', 'Vali väline videofail')}
              </button>
              <button
                type="button"
                onClick={downloadPresentationVideo}
                disabled={!presentationVideo}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-teal-600 text-teal-900 bg-teal-50 hover:bg-teal-100 disabled:opacity-50"
              >
                {tr('studio.downloadVideo', 'Lae video alla')}
              </button>
              <button
                type="button"
                onClick={uploadPresentationVideoToDrive}
                disabled={!presentationVideo || !!busy}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-teal-700 bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {tr('studio.uploadVideoDrive', 'Kanna video Drive’i')}
              </button>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*,.mp4,.webm,.mov"
                className="hidden"
                onChange={onPickPresentationVideo}
              />
            </div>
            {presentationVideo ? (
              <p className="text-[11px] text-zinc-600 font-mono truncate">
                {presentationVideo.fileName}
                {presentationVideo.blob?.size ? ` · ${Math.round(presentationVideo.blob.size / 1024)} KB` : ''}
              </p>
            ) : null}
            {doc.videoAsset?.fileId ? (
              <p className="text-[11px] text-teal-800">
                {tr('studio.videoAssetRef', 'Drive video:')} {doc.videoAsset.fileName} ({doc.videoAsset.fileId})
              </p>
            ) : null}
            <p className="text-[11px] text-zinc-500">
              {tr(
                'studio.exportFolderHint',
                'Salvestuskaust = URL saveFolderId (või root) — eelistatult sama kaust mis nooditööfail. Sisseehitatud MP4 render tuleb järgmises faasis; praegu saad valmis video failina kinnitada.'
              )}
            </p>
          </div>
        )}

        {activePanel === 'cursor' && (
          <div className="space-y-3 max-w-xl">
            <p className="text-xs font-bold text-zinc-700">{tr('studio.cursorMotion', 'Playback cursori liikumine')}</p>
            <div className="flex flex-wrap gap-2">
              {MOTION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchDoc((prev) => setPlaybackCursor(prev, { motion: opt.id }))}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border ${
                    cursor.motion === opt.id
                      ? 'bg-teal-700 text-white border-teal-800'
                      : 'bg-white border-zinc-300 text-zinc-800'
                  }`}
                >
                  {tr(opt.labelKey, opt.id)}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <span className="font-semibold">{tr('studio.cursorEmoji', 'Emoji / glüüf')}</span>
              <input
                value={cursor.emoji || ''}
                onChange={(e) => patchDoc((prev) => setPlaybackCursor(prev, { emoji: e.target.value }))}
                className="w-20 px-2 py-1 rounded border border-zinc-300 text-center text-base"
                maxLength={8}
              />
            </label>
            {needsQuantize ? (
              <div className="space-y-2 text-xs p-2 rounded-md bg-amber-50 border border-amber-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-amber-900">
                    {tr('studio.quantizeRequired', 'Quantize — kui tihedalt playhead hüppab')}
                  </span>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={!!cursor.quantize?.enabled}
                      onChange={(e) => patchDoc((prev) => setPlaybackCursor(prev, {
                        quantize: { ...(prev.playback?.cursor?.quantize || {}), enabled: e.target.checked },
                      }))}
                    />
                    {tr('studio.quantizeOn', 'Sees')}
                  </label>
                </div>
                <p className="text-amber-900/80">
                  {tr(
                    'studio.quantizeHint',
                    'Nt partituuris 1/16, quantize 1/8 → hüpe üle ühe 1/16. Quantize 1/4 → playhead ootab järgmise veerandnoodi ruuduni.'
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PLAYHEAD_QUANTIZE_GRIDS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => patchDoc((prev) => setPlaybackCursor(prev, {
                        quantize: { ...(prev.playback?.cursor?.quantize || {}), unit: u, enabled: true },
                      }))}
                      className={`px-2 py-1 rounded-md text-xs font-semibold border ${
                        cursor.quantize?.unit === u
                          ? 'bg-amber-700 text-white border-amber-800'
                          : 'bg-white border-amber-300 text-amber-950'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <section className="flex-1 min-h-[36vh] border-b lg:border-b-0 lg:border-r border-zinc-200 bg-white p-4 flex flex-col relative overflow-hidden">
          <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">
            {tr('studio.scorePanel', 'Partituuri vaade')}
          </h2>
          <div className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 relative overflow-hidden">
            {hasScore ? (
              <div className="p-4 space-y-2">
                <p className="text-sm font-semibold text-zinc-800">
                  {doc.score.displayName || tr('studio.scoreLoaded', 'Partituur laetud')}
                </p>
                <p className="text-xs text-zinc-600">
                  {doc.score.source === 'noodimeister'
                    ? tr('studio.sourceNm', 'Allikas: Noodimeistri tööfail (rikas snapshot + kujundus)')
                    : tr('studio.sourceXml', 'Allikas: MusicXML')}
                </p>
                {doc.score.source === 'noodimeister' && doc.score.snapshot ? (
                  <p className="text-[11px] text-zinc-500 font-mono">
                    notes: {Array.isArray(doc.score.snapshot.notes) ? doc.score.snapshot.notes.length : '—'}
                    {' · '}
                    mode: {doc.score.snapshot.notationMode || doc.score.snapshot.sourceNotationMode || '—'}
                  </p>
                ) : null}
                {doc.score.source === 'musicxml' && doc.score.musicXml ? (
                  <p className="text-[11px] text-zinc-500">
                    MusicXML {Math.round(doc.score.musicXml.length / 1024)} KB — render järgmises faasis.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-6 text-center text-sm text-zinc-500">
                {tr('studio.scoreEmpty', 'Impordi MusicXML või Noodimeistri tööfail.')}
              </div>
            )}
            {/* Playhead overlay preview */}
            <div
              className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none z-10"
              style={{ left: `${playheadPct}%`, ...playheadStyle }}
            >
              <span
                className={`text-lg leading-none ${
                  cursor.motion === CURSOR_MOTION_TRIANGLE_JUMP ? 'text-orange-600' : 'text-teal-700'
                }`}
                style={cursor.motion === CURSOR_MOTION_TRIANGLE_JUMP ? { clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' } : undefined}
              >
                {cursor.emoji || '┃'}
              </span>
              <div
                className={`w-0.5 flex-1 ${
                  cursor.motion === CURSOR_MOTION_TRIANGLE_JUMP ? 'bg-orange-500' : 'bg-teal-600'
                } ${cursor.motion === CURSOR_MOTION_ARC ? 'opacity-80' : ''}`}
              />
            </div>
          </div>
        </section>

        <section className="w-full lg:w-[400px] flex flex-col bg-zinc-50">
          <div className="p-4 border-b border-zinc-200 bg-white space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
              {tr('studio.mediaPanel', 'Heli / media')}
            </h2>
            {mediaUrl ? (
              <>
                <audio ref={audioRef} src={mediaUrl} preload="metadata" className="w-full" controls />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold bg-zinc-900 text-white"
                  >
                    {playing ? tr('studio.pause', 'Paus') : tr('studio.play', 'Play')}
                  </button>
                  <button
                    type="button"
                    onClick={() => seekTo(0)}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold border border-zinc-300 bg-white"
                  >
                    {tr('studio.toStart', 'Algusesse')}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 truncate">{doc.media?.local?.fileName}</p>
              </>
            ) : (
              <p className="text-xs text-zinc-500">{tr('studio.noAudio', 'Helifaili pole — Impordi paneelist lae heli.')}</p>
            )}
          </div>

          <div className="p-4 flex-1">
            <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2">
              {tr('studio.ruler', 'Ruler / sync')}
            </h2>
            <div
              className="h-14 rounded-lg border border-zinc-300 bg-white relative cursor-pointer"
              onClick={(e) => {
                if (!mediaUrl || !duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                seekTo(pct * duration);
              }}
              role="presentation"
            >
              {(doc.sync?.points || []).map((p) => {
                const pct = duration > 0 ? (p.mediaSec / duration) * 100 : 0;
                return (
                  <div
                    key={p.id}
                    title={`M${p.measureIndex}`}
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-500"
                    style={{ left: `${Math.min(100, pct)}%` }}
                  />
                );
              })}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-teal-700 z-10"
                style={{ left: `${playheadPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              {(doc.scenes || []).length} {tr('studio.scenesCount', 'stseeni')}
              {' · '}
              {(doc.sync?.points || []).length} sync
            </p>
          </div>
        </section>
      </main>

      <footer className="px-4 py-2 bg-white border-t border-zinc-200 text-[11px] text-zinc-500 flex flex-wrap gap-2 items-center">
        <span className="font-mono">{fileName}</span>
        <span>·</span>
        <span>{tr('studio.stubNote', 'Montaaž — import, stseenid, sync, playhead. Video redaktor ja MP4 eksport järgmistes sammudes.')}</span>
      </footer>
    </div>
  );
}
