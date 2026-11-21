/**
 * Noodigraafika mängija ↔ süsteemi esitusklahvid (Mac media keys, kõrvaklappide nupud).
 *
 * Web Audio üksi ei registreeri macOS-is “Now Playing” sessiooni, seega hoiame
 * vaikset HTMLAudioElementi. Meedianupud jõuavad lehele Media Session API kaudu
 * ainult siis, kui mängija aken on avatud või noodigraafika taasesitus käib.
 */

const MEDIA_ACTIONS = ['play', 'pause', 'stop', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward'];

let audioEl = null;
let applying = false;
let desiredPlaying = false;
let listenersBound = false;
const handlersRef = { current: null };

function ensureSilentAudio() {
  if (typeof window === 'undefined') return null;
  if (audioEl) return audioEl;
  let url = '';
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate;
    const dataSize = numSamples * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);
    url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  } catch (_) {
    url = '';
  }
  if (!url) return null;
  const el = new Audio(url);
  el.loop = true;
  el.preload = 'auto';
  el.setAttribute('playsinline', '');
  el.volume = 0;
  audioEl = el;
  return el;
}

function bindElementListeners(el) {
  if (!el || listenersBound) return;
  listenersBound = true;
  el.addEventListener('play', () => {
    if (applying) return;
    handlersRef.current?.onPlay?.();
  });
  el.addEventListener('pause', () => {
    if (applying) return;
    handlersRef.current?.onPause?.();
  });
}

/**
 * Kasutaja klikk (mängija avamine) registreerib vahelehe meediaklahvide sihiks,
 * ilma et lugu veel käivituks.
 */
export function primeScoreMediaSession() {
  if (desiredPlaying) return;
  const el = ensureSilentAudio();
  if (!el) return;
  applying = true;
  const finish = () => {
    try {
      if (!desiredPlaying) el.pause();
    } catch (_) { /* ignore */ }
    setTimeout(() => {
      applying = false;
    }, 0);
  };
  try {
    const pending = el.play();
    if (pending && typeof pending.then === 'function') pending.then(finish, () => { applying = false; });
    else finish();
  } catch (_) {
    applying = false;
  }
}

/** Hoia vaikselt audio-elemendi olek sünkroonis noodigraafika taasesitusega. */
export function setScoreMediaElementPlaying(playing) {
  desiredPlaying = !!playing;
  const el = ensureSilentAudio();
  if (!el) return;
  applying = true;
  try {
    if (playing) {
      const pending = el.play();
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } else if (!el.paused) {
      el.pause();
    }
  } catch (_) { /* ignore */ } finally {
    setTimeout(() => {
      applying = false;
    }, 0);
  }
}

export function syncScoreMediaSession({
  playing = false,
  title = 'Noodigraafika',
  artist = 'Noodimeister',
  onPlay,
  onPause,
  onStop,
  onPrevious,
  onNext,
  onSeekBack,
  onSeekForward,
} = {}) {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
  const session = navigator.mediaSession;
  handlersRef.current = {
    onPlay,
    onPause,
    onStop,
    onPrevious,
    onNext,
    onSeekBack,
    onSeekForward,
  };
  const el = ensureSilentAudio();
  bindElementListeners(el);
  try {
    session.metadata = new MediaMetadata({
      title: title || 'Noodigraafika',
      artist: artist || 'Noodimeister',
    });
  } catch (_) { /* ignore */ }
  try {
    session.playbackState = playing ? 'playing' : 'paused';
  } catch (_) { /* ignore */ }

  const actionMap = {
    play: () => handlersRef.current?.onPlay?.(),
    pause: () => handlersRef.current?.onPause?.(),
    stop: () => handlersRef.current?.onStop?.(),
    previoustrack: () => handlersRef.current?.onPrevious?.(),
    nexttrack: () => handlersRef.current?.onNext?.(),
    seekbackward: () => handlersRef.current?.onSeekBack?.(),
    seekforward: () => handlersRef.current?.onSeekForward?.(),
  };
  MEDIA_ACTIONS.forEach((name) => {
    try {
      session.setActionHandler(name, actionMap[name]);
    } catch (_) { /* action unsupported */ }
  });
}

export function releaseScoreMediaSession() {
  handlersRef.current = null;
  desiredPlaying = false;
  if (typeof navigator !== 'undefined' && navigator.mediaSession) {
    const session = navigator.mediaSession;
    try { session.playbackState = 'none'; } catch (_) { /* ignore */ }
    try { session.metadata = null; } catch (_) { /* ignore */ }
    MEDIA_ACTIONS.forEach((name) => {
      try { session.setActionHandler(name, null); } catch (_) { /* ignore */ }
    });
  }
  if (audioEl && !audioEl.paused) {
    applying = true;
    try { audioEl.pause(); } catch (_) { /* ignore */ }
    setTimeout(() => { applying = false; }, 0);
  }
}

/** Taasesituse ajatelje piir [0, totalBeats]. */
export function clampPlaybackBeat(beat, totalBeats) {
  const total = Number.isFinite(totalBeats) ? Math.max(0, totalBeats) : 0;
  const value = Number.isFinite(beat) ? beat : 0;
  if (value <= 0) return 0;
  if (value >= total) return total;
  return value;
}
