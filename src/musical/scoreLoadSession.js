/**
 * Faili loading-session: paigutuse paint + failis kasutatud instrumentide soundfontide eellaadimine.
 * Kestus / progress kasvab unikaalsete pillide ja skoori mahuga (struktuurne weight).
 */

import {
  SOUNDFONT_FORMAT,
  SOUNDFONT_PACK,
  soundfontNameForInstrumentId,
  soundfontNameToUrl,
  soundfontPackForInstrumentId,
  soundfontPlayerCacheKey,
} from './soundLibrary.js';

export const SCORE_LOAD_PHASE_LAYOUT = 'layout';
export const SCORE_LOAD_PHASE_SOUNDS = 'sounds';
export const SCORE_LOAD_PHASE_READY = 'ready';

/** Vaikimisi timeout ühe soundfonti laadimisele (ms). */
export const DEFAULT_SOUNDFONT_LOAD_TIMEOUT_MS = 20000;

/**
 * Unikaalsed instrumentId-d projektist (staves + legacy instrument).
 * @param {object|null|undefined} data
 * @returns {string[]}
 */
export function collectInstrumentIdsFromProject(data) {
  const ids = [];
  const seen = new Set();
  const add = (raw) => {
    const id = String(raw || '').trim() || 'single-staff-treble';
    if (seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  if (!data || typeof data !== 'object') {
    add('single-staff-treble');
    return ids;
  }
  if (Array.isArray(data.staves) && data.staves.length > 0) {
    for (const staff of data.staves) {
      add(staff?.instrumentId);
    }
  } else {
    add(data.instrument);
  }
  return ids;
}

/**
 * Märkmete arv progressi weight’iks (kõik stave’id + legacy notes).
 * @param {object|null|undefined} data
 * @returns {number}
 */
export function countNotesInProject(data) {
  if (!data || typeof data !== 'object') return 0;
  let n = 0;
  if (Array.isArray(data.staves)) {
    for (const staff of data.staves) {
      if (Array.isArray(staff?.notes)) n += staff.notes.length;
    }
  }
  const legacy = data.scoreData ?? data.notes;
  if (Array.isArray(legacy)) n += legacy.length;
  return n;
}

/**
 * Struktuurne “kaal” UI progressiks (mitte kunstlik delay).
 * Rohkem pille / stave’e / noote → suurem weight.
 * @param {{ instrumentCount?: number, noteCount?: number, staffCount?: number }} opts
 * @returns {number}
 */
export function estimateLoadWeight({ instrumentCount = 1, noteCount = 0, staffCount = 1 } = {}) {
  const instruments = Math.max(1, Number(instrumentCount) || 1);
  const notes = Math.max(0, Number(noteCount) || 0);
  const staves = Math.max(1, Number(staffCount) || 1);
  // Pillid domineerivad (SF laadimine); noodid/stavid peegeldavad paigutuse mahtu.
  return instruments * 10 + staves * 2 + Math.min(50, Math.floor(notes / 20));
}

/**
 * Weight otse projektist.
 * @param {object|null|undefined} data
 * @returns {number}
 */
export function estimateLoadWeightFromProject(data) {
  const instrumentIds = collectInstrumentIdsFromProject(data);
  const staffCount = Array.isArray(data?.staves) && data.staves.length > 0
    ? data.staves.length
    : 1;
  return estimateLoadWeight({
    instrumentCount: instrumentIds.length,
    noteCount: countNotesInProject(data),
    staffCount,
  });
}

/** Paigutusfaasi osa 0–100 skaalal (heli võtab ülejäänu). */
export const LOAD_PROGRESS_LAYOUT_PERCENT = 12;

/**
 * Sessiooni progress 0…100.
 * layout → ~0–12%; sounds → 12–100% (done/total); ready → 100.
 * @param {{ phase?: string, done?: number, total?: number }} p
 * @returns {number}
 */
export function computeLoadProgressPercent(p = {}) {
  const phase = p.phase || SCORE_LOAD_PHASE_LAYOUT;
  if (phase === SCORE_LOAD_PHASE_READY || phase === 'ready') return 100;
  const total = Math.max(1, Number(p.total) || 1);
  const done = Math.max(0, Math.min(total, Number(p.done) || 0));
  if (phase === SCORE_LOAD_PHASE_LAYOUT || phase === 'layout') {
    // Layout alguses 0, pärast paint’i enne heli ~LAYOUT%
    return done > 0 ? LOAD_PROGRESS_LAYOUT_PERCENT : 0;
  }
  // sounds
  const span = 100 - LOAD_PROGRESS_LAYOUT_PERCENT;
  return Math.round(LOAD_PROGRESS_LAYOUT_PERCENT + (done / total) * span);
}

/**
 * Oota vähemalt ühte layout paint’i (+ fondid kui saadaval).
 * @returns {Promise<void>}
 */
export function waitForLayoutPaint() {
  return new Promise((resolve) => {
    const finish = async () => {
      try {
        if (typeof document !== 'undefined' && document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch (_) { /* ignore */ }
      resolve();
    };
    if (typeof requestAnimationFrame !== 'function') {
      setTimeout(finish, 0);
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        finish();
      });
    });
  });
}

function withTimeout(promise, ms, label) {
  const timeoutMs = Math.max(1000, Number(ms) || DEFAULT_SOUNDFONT_LOAD_TIMEOUT_MS);
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: `timeout:${label || 'soundfont'}` });
    }, timeoutMs);
    Promise.resolve(promise)
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok: true, value });
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, error });
      });
  });
}

/**
 * Eellaadi soundfontid instrumentId nimekirja jaoks.
 * Ebaõnnestunud / timeout’iga pillid jäetakse vahele (ei blokeeri sessiooni).
 *
 * @param {string[]} instrumentIds
 * @param {object} deps
 * @param {AudioContext} deps.audioContext
 * @param {Record<string, unknown>} deps.cache - soundfontPlayerCacheKey → player
 * @param {{ instrument: Function }} deps.Soundfont
 * @param {(p: { done: number, total: number, instrumentId: string, ok: boolean }) => void} [deps.onProgress]
 * @param {number} [deps.timeoutMs]
 * @returns {Promise<{ loaded: string[], failed: string[] }>}
 */
export async function preloadSoundfontsForInstruments(instrumentIds, deps = {}) {
  const {
    audioContext,
    cache,
    Soundfont,
    onProgress,
    timeoutMs = DEFAULT_SOUNDFONT_LOAD_TIMEOUT_MS,
  } = deps;
  const ids = Array.isArray(instrumentIds) ? [...new Set(instrumentIds.filter(Boolean))] : [];
  const total = ids.length;
  const loaded = [];
  const failed = [];

  if (!audioContext || !cache || !Soundfont || typeof Soundfont.instrument !== 'function') {
    ids.forEach((instrumentId, i) => {
      failed.push(instrumentId);
      onProgress?.({ done: i + 1, total, instrumentId, ok: false });
    });
    return { loaded, failed };
  }

  let done = 0;
  for (const instrumentId of ids) {
    const sfCacheKey = soundfontPlayerCacheKey(instrumentId);
    if (cache[sfCacheKey]) {
      loaded.push(instrumentId);
      done += 1;
      onProgress?.({ done, total, instrumentId, ok: true });
      continue;
    }
    const soundfontName = soundfontNameForInstrumentId(instrumentId);
    const soundfontPack = soundfontPackForInstrumentId(instrumentId);
    const result = await withTimeout(
      Soundfont.instrument(audioContext, soundfontName, {
        soundfont: soundfontPack || SOUNDFONT_PACK,
        format: SOUNDFONT_FORMAT,
        nameToUrl: soundfontNameToUrl,
      }),
      timeoutMs,
      instrumentId
    );
    if (result.ok && result.value) {
      cache[sfCacheKey] = result.value;
      loaded.push(instrumentId);
      onProgress?.({ done: done + 1, total, instrumentId, ok: true });
    } else {
      failed.push(instrumentId);
      onProgress?.({ done: done + 1, total, instrumentId, ok: false });
    }
    done += 1;
  }

  return { loaded, failed };
}

/**
 * Täielik loading-session pärast projekti hydrate’i.
 * @param {object} projectData
 * @param {object} deps - sama mis preloadSoundfontsForInstruments + ensureAudioContext
 * @param {(state: { phase: string, done: number, total: number, instrumentId?: string }) => void} [deps.onPhase]
 * @param {() => boolean} [deps.isCancelled] - true → katkesta
 * @returns {Promise<{ weight: number, loaded: string[], failed: string[] }>}
 */
export async function runScoreLoadSession(projectData, deps = {}) {
  const { onPhase, isCancelled, ensureAudioContext, ...preloadDeps } = deps;
  const instrumentIds = collectInstrumentIdsFromProject(projectData);
  const weight = estimateLoadWeightFromProject(projectData);

  const total = Math.max(1, instrumentIds.length);
  onPhase?.({
    phase: SCORE_LOAD_PHASE_LAYOUT,
    done: 0,
    total,
  });
  await waitForLayoutPaint();
  if (isCancelled?.()) {
    return { weight, loaded: [], failed: instrumentIds };
  }
  onPhase?.({
    phase: SCORE_LOAD_PHASE_LAYOUT,
    done: 1,
    total,
  });

  let audioContext = preloadDeps.audioContext;
  if (!audioContext && typeof ensureAudioContext === 'function') {
    try {
      audioContext = ensureAudioContext();
    } catch (_) {
      audioContext = null;
    }
  }

  onPhase?.({
    phase: SCORE_LOAD_PHASE_SOUNDS,
    done: 0,
    total,
  });

  const { loaded, failed } = await preloadSoundfontsForInstruments(instrumentIds, {
    ...preloadDeps,
    audioContext,
    onProgress: (p) => {
      if (isCancelled?.()) return;
      onPhase?.({
        phase: SCORE_LOAD_PHASE_SOUNDS,
        done: p.done,
        total: p.total,
        instrumentId: p.instrumentId,
      });
    },
  });

  if (!isCancelled?.()) {
    onPhase?.({
      phase: SCORE_LOAD_PHASE_READY,
      done: instrumentIds.length,
      total: Math.max(1, instrumentIds.length),
    });
  }

  return { weight, loaded, failed };
}
