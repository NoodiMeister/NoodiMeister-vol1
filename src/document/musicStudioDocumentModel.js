/**
 * Muusika stuudio · Montaaž document model (.nms).
 * Separate from notation (.nm) and kujundaja (.nmc).
 * Montaaž has ZERO notation-editor toolboxes — score is import + view only.
 */

export const MUSIC_STUDIO_PROJECT_KIND = 'musicStudio';
export const MUSIC_STUDIO_FILE_EXT = '.nms';
export const MUSIC_STUDIO_DOC_TYPE = 'noodimeister-music-studio';

export const SCORE_SOURCE_NOODIMEISTER = 'noodimeister';
export const SCORE_SOURCE_MUSICXML = 'musicxml';

/** Playback cursor motion styles (Soundslice-like playhead). */
export const CURSOR_MOTION_LINEAR = 'linear';
export const CURSOR_MOTION_JUMP = 'jump';
export const CURSOR_MOTION_ARC = 'arc';
export const CURSOR_MOTION_TRIANGLE_JUMP = 'triangleJump';

export const CURSOR_MOTIONS = [
  CURSOR_MOTION_LINEAR,
  CURSOR_MOTION_JUMP,
  CURSOR_MOTION_ARC,
  CURSOR_MOTION_TRIANGLE_JUMP,
];

export const DEFAULT_CURSOR_EMOJI = '┃';

/** @deprecated use PLAYHEAD_QUANTIZE_GRIDS from playheadQuantize.js — kept for old imports */
export const QUANTIZE_UNITS = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32'];

export function isMusicStudioFileName(name) {
  const n = String(name || '').toLowerCase();
  return n.endsWith(MUSIC_STUDIO_FILE_EXT) || n.endsWith('.nms.json');
}

export function isMusicStudioDocumentJson(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.docType === MUSIC_STUDIO_DOC_TYPE) return true;
  if (data.projectKind === MUSIC_STUDIO_PROJECT_KIND) return true;
  return false;
}

export function parseMusicStudioFileTitle(fileName) {
  const raw = String(fileName || '').trim();
  if (!raw) return 'Montaaž';
  return raw
    .replace(/\.nms\.json$/i, '')
    .replace(/\.nms$/i, '')
    .replace(/\.json$/i, '')
    .trim() || 'Montaaž';
}

export function buildMusicStudioFileName(title) {
  const base = String(title || 'Montaaž')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'Montaaž';
  return `${base}${MUSIC_STUDIO_FILE_EXT}`;
}

export function createDefaultPlaybackCursor() {
  return {
    motion: CURSOR_MOTION_LINEAR,
    emoji: DEFAULT_CURSOR_EMOJI,
    quantize: {
      enabled: false,
      /** Rütmivõre: 1/4 = veerandnoodi kaupa; peenem = sagedasem hüpe */
      unit: '1/4',
    },
  };
}

export function normalizePlaybackCursor(raw) {
  const base = createDefaultPlaybackCursor();
  if (!raw || typeof raw !== 'object') return base;
  const motion = CURSOR_MOTIONS.includes(raw.motion) ? raw.motion : base.motion;
  const needsQuantize = motion === CURSOR_MOTION_JUMP || motion === CURSOR_MOTION_TRIANGLE_JUMP;
  const quantizeIn = raw.quantize && typeof raw.quantize === 'object' ? raw.quantize : {};
  // Lazy import avoided: inline legacy map for unit normalize
  const legacy = { beat: '1/4', halfBeat: '1/8', measure: '1/1' };
  let unit = quantizeIn.unit;
  if (legacy[unit]) unit = legacy[unit];
  if (!QUANTIZE_UNITS.includes(unit)) unit = '1/4';
  return {
    motion,
    emoji: typeof raw.emoji === 'string' && raw.emoji.trim() ? raw.emoji.trim().slice(0, 8) : base.emoji,
    quantize: {
      enabled: needsQuantize ? (quantizeIn.enabled !== false) : !!quantizeIn.enabled,
      unit,
    },
  };
}

export function createSceneBox(overrides = {}) {
  const id = overrides.id || `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name: String(overrides.name ?? '1').trim() || '1',
    startSec: Number.isFinite(overrides.startSec) ? overrides.startSec : 0,
    endSec: Number.isFinite(overrides.endSec) ? overrides.endSec : null,
    measureIndex: Number.isFinite(overrides.measureIndex) ? overrides.measureIndex : null,
    notes: typeof overrides.notes === 'string' ? overrides.notes : '',
  };
}

export function createSyncPoint(overrides = {}) {
  return {
    id: overrides.id || `sync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    measureIndex: Number.isFinite(overrides.measureIndex) ? overrides.measureIndex : 0,
    beatInMeasure: Number.isFinite(overrides.beatInMeasure) ? overrides.beatInMeasure : 0,
    mediaSec: Number.isFinite(overrides.mediaSec) ? overrides.mediaSec : 0,
    source: overrides.source || 'manual',
  };
}

export function createEmptyScore() {
  return {
    source: null, // 'noodimeister' | 'musicxml'
    link: null,
    snapshot: null,
    musicXml: null,
    importedAt: null,
    displayName: null,
  };
}

export function createMusicStudioDocument(overrides = {}) {
  const now = new Date().toISOString();
  return {
    docType: MUSIC_STUDIO_DOC_TYPE,
    projectKind: MUSIC_STUDIO_PROJECT_KIND,
    schemaVersion: 1,
    title: overrides.title || 'Uus montaaž',
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    score: overrides.score && typeof overrides.score === 'object'
      ? { ...createEmptyScore(), ...overrides.score }
      : createEmptyScore(),
    media: overrides.media || null,
    // Soundslice-like sync anchors: measure/beat ↔ mediaSec
    sync: {
      mode: 'measureMap',
      unit: 'measure',
      points: Array.isArray(overrides.sync?.points)
        ? overrides.sync.points
        : (Array.isArray(overrides.syncMap) ? overrides.syncMap : []),
    },
    // Video scene boxes → feed video editor
    scenes: Array.isArray(overrides.scenes)
      ? overrides.scenes.map((s) => createSceneBox(s))
      : [],
    playback: {
      cursor: normalizePlaybackCursor(overrides.playback?.cursor),
      loop: overrides.playback?.loop ?? null,
      showRuler: overrides.playback?.showRuler !== false,
    },
    /** draft = poolik montaaž; final = esitlusvalmis */
    status: overrides.status === 'final' ? 'final' : 'draft',
    /** Renderitud / üleslaetud esitlusvideo Drive'is (eraldiseisvalt esitatav) */
    videoAsset: overrides.videoAsset || null,
    exportSettings: overrides.exportSettings || { defaultFormat: 'mp4' },
    meta: overrides.meta || {},
  };
}

export function normalizeMusicStudioDocument(raw) {
  const base = createMusicStudioDocument();
  if (!raw || typeof raw !== 'object') return base;
  const syncPoints = Array.isArray(raw.sync?.points)
    ? raw.sync.points
    : (Array.isArray(raw.syncMap) ? raw.syncMap : []);
  return {
    ...base,
    ...raw,
    docType: MUSIC_STUDIO_DOC_TYPE,
    projectKind: MUSIC_STUDIO_PROJECT_KIND,
    schemaVersion: 1,
    score: raw.score && typeof raw.score === 'object'
      ? { ...createEmptyScore(), ...raw.score }
      : createEmptyScore(),
    sync: {
      mode: raw.sync?.mode || 'measureMap',
      unit: raw.sync?.unit || 'measure',
      points: syncPoints,
    },
    scenes: Array.isArray(raw.scenes) ? raw.scenes.map((s) => createSceneBox(s)) : [],
    playback: {
      cursor: normalizePlaybackCursor(raw.playback?.cursor),
      loop: raw.playback?.loop ?? null,
      showRuler: raw.playback?.showRuler !== false,
    },
    status: raw.status === 'final' ? 'final' : 'draft',
    videoAsset: raw.videoAsset && typeof raw.videoAsset === 'object' ? raw.videoAsset : null,
    exportSettings: raw.exportSettings && typeof raw.exportSettings === 'object'
      ? raw.exportSettings
      : { defaultFormat: 'mp4' },
    meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : {},
  };
}

export function setDocStatus(doc, status) {
  return touchMusicStudioMeta({
    ...doc,
    status: status === 'final' ? 'final' : 'draft',
  });
}

export function setVideoAsset(doc, asset) {
  return touchMusicStudioMeta({
    ...doc,
    videoAsset: asset
      ? {
          provider: asset.provider || 'google',
          fileId: asset.fileId || null,
          folderId: asset.folderId || 'root',
          fileName: asset.fileName || 'montaaz.mp4',
          mimeType: asset.mimeType || 'video/mp4',
          uploadedAt: asset.uploadedAt || new Date().toISOString(),
        }
      : null,
  });
}

export function touchMusicStudioMeta(doc) {
  return {
    ...doc,
    updatedAt: new Date().toISOString(),
  };
}

/** Attach a rich Noodimeister project JSON as score snapshot (no-overwrite of source file). */
export function importNoodimeisterScore(doc, projectJson, meta = {}) {
  const name = meta.fileName || projectJson?.songTitle || projectJson?.title || 'Tööfail';
  return touchMusicStudioMeta({
    ...doc,
    title: doc.title === 'Uus montaaž' || !doc.title ? String(name).replace(/\.nm$/i, '') : doc.title,
    score: {
      source: SCORE_SOURCE_NOODIMEISTER,
      link: meta.link || null,
      snapshot: projectJson,
      musicXml: null,
      importedAt: new Date().toISOString(),
      displayName: name,
    },
  });
}

/** Attach MusicXML text from computer. */
export function importMusicXmlScore(doc, xmlText, meta = {}) {
  const name = meta.fileName || 'MusicXML';
  return touchMusicStudioMeta({
    ...doc,
    title: doc.title === 'Uus montaaž' || !doc.title ? String(name).replace(/\.(musicxml|xml)$/i, '') : doc.title,
    score: {
      source: SCORE_SOURCE_MUSICXML,
      link: null,
      snapshot: null,
      musicXml: String(xmlText || ''),
      importedAt: new Date().toISOString(),
      displayName: name,
    },
  });
}

export function setMediaAudioLocal(doc, { fileName, mimeType, objectUrl, durationSec = null }) {
  return touchMusicStudioMeta({
    ...doc,
    media: {
      kind: 'audioFile',
      local: {
        fileName: fileName || 'audio',
        mimeType: mimeType || 'audio/*',
        objectUrl: objectUrl || null,
        durationSec,
      },
      asset: null,
      youtube: null,
    },
  });
}

export function addSceneToDoc(doc, name, opts = {}) {
  const scenes = [...(doc.scenes || []), createSceneBox({
    name,
    startSec: Number.isFinite(opts.startSec) ? opts.startSec : 0,
    endSec: Number.isFinite(opts.endSec) ? opts.endSec : null,
  })];
  return touchMusicStudioMeta({ ...doc, scenes });
}

export function updateSceneInDoc(doc, sceneId, patch) {
  const scenes = (doc.scenes || []).map((s) => (
    s.id === sceneId ? createSceneBox({ ...s, ...patch, id: s.id }) : s
  ));
  return touchMusicStudioMeta({ ...doc, scenes });
}

export function removeSceneFromDoc(doc, sceneId) {
  return touchMusicStudioMeta({
    ...doc,
    scenes: (doc.scenes || []).filter((s) => s.id !== sceneId),
  });
}

export function addSyncPointToDoc(doc, point) {
  const points = [...(doc.sync?.points || []), createSyncPoint(point)];
  return touchMusicStudioMeta({
    ...doc,
    sync: { ...(doc.sync || {}), points },
  });
}

export function removeSyncPointFromDoc(doc, pointId) {
  const points = (doc.sync?.points || []).filter((p) => p.id !== pointId);
  return touchMusicStudioMeta({
    ...doc,
    sync: { ...(doc.sync || {}), points },
  });
}

export function updateSyncPointInDoc(doc, pointId, patch) {
  const points = (doc.sync?.points || []).map((p) => (
    p.id === pointId ? createSyncPoint({ ...p, ...patch, id: p.id }) : p
  ));
  return touchMusicStudioMeta({
    ...doc,
    sync: { ...(doc.sync || {}), points },
  });
}

export function setPlaybackCursor(doc, cursorPatch) {
  const next = normalizePlaybackCursor({ ...(doc.playback?.cursor || {}), ...cursorPatch });
  return touchMusicStudioMeta({
    ...doc,
    playback: { ...(doc.playback || {}), cursor: next },
  });
}
