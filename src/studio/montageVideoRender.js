/**
 * Montaaž video render: canvas frames + audio → MediaRecorder blob.
 * Prefers MP4 when the browser supports it; otherwise WebM (Chrome typical).
 * No notation-editor tools — draws a presentation frame from montage doc + sync.
 */

import { estimateTotalBeatsFromDoc, quantizeProgress01 } from './playheadQuantize.js';
import {
  CURSOR_MOTION_JUMP,
  CURSOR_MOTION_TRIANGLE_JUMP,
} from '../document/musicStudioDocumentModel.js';

export function pickRecorderMime() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return { mimeType: 'video/webm', ext: 'webm' };
  }
  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      return { mimeType, ext };
    }
  }
  return { mimeType: 'video/webm', ext: 'webm' };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/** Interpolate media time → 0..1 progress along score using sync anchors. */
export function mediaSecToProgress(points, mediaSec, durationSec) {
  const dur = Math.max(0.001, Number(durationSec) || 1);
  const t = clamp(Number(mediaSec) || 0, 0, dur);
  const sorted = (Array.isArray(points) ? points : [])
    .map((p) => ({
      mediaSec: Number(p.mediaSec) || 0,
      measureIndex: Number(p.measureIndex) || 0,
    }))
    .sort((a, b) => a.mediaSec - b.mediaSec);

  if (sorted.length === 0) return t / dur;

  const maxMeasure = Math.max(1, ...sorted.map((p) => p.measureIndex + 1));
  if (t <= sorted[0].mediaSec) {
    return sorted[0].measureIndex / maxMeasure;
  }
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.mediaSec && t <= b.mediaSec) {
      const span = Math.max(1e-6, b.mediaSec - a.mediaSec);
      const u = (t - a.mediaSec) / span;
      const m = a.measureIndex + u * (b.measureIndex - a.measureIndex);
      return clamp(m / maxMeasure, 0, 1);
    }
  }
  const last = sorted[sorted.length - 1];
  return clamp(last.measureIndex / maxMeasure, 0, 1);
}

function activeSceneAt(scenes, mediaSec) {
  const list = Array.isArray(scenes) ? scenes : [];
  let best = null;
  for (const s of list) {
    const start = Number(s.startSec) || 0;
    const end = s.endSec == null ? Infinity : Number(s.endSec);
    if (mediaSec >= start && mediaSec < end) {
      if (!best || start >= (Number(best.startSec) || 0)) best = s;
    }
  }
  return best;
}

function drawFrame(ctx, {
  width,
  height,
  title,
  scoreLabel,
  mediaSec,
  durationSec,
  progress,
  cursorEmoji,
  cursorMotion,
  scene,
  syncCount,
  sceneCount,
}) {
  // Background
  ctx.fillStyle = '#fafaf9';
  ctx.fillRect(0, 0, width, height);

  // Header bar
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(0, 0, width, 72);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Muusika stuudio · Montaaž', 28, 28);
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillText(String(title || 'Montaaž').slice(0, 60), 28, 52);

  // Score card
  const cardX = 40;
  const cardY = 100;
  const cardW = width - 80;
  const cardH = height - 220;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 16);
  ctx.fill();
  ctx.stroke();

  // Fake staff lines
  const staffTop = cardY + 80;
  const staffGap = Math.min(28, cardH / 12);
  ctx.strokeStyle = '#a1a1aa';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i += 1) {
    const y = staffTop + i * staffGap;
    ctx.beginPath();
    ctx.moveTo(cardX + 40, y);
    ctx.lineTo(cardX + cardW - 40, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#3f3f46';
  ctx.font = '500 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(String(scoreLabel || 'Partituur').slice(0, 80), cardX + 40, cardY + 36);

  // Sync ticks under staff
  const trackX0 = cardX + 40;
  const trackX1 = cardX + cardW - 40;
  const trackW = trackX1 - trackX0;
  const playheadX = trackX0 + progress * trackW;
  const staffMidY = staffTop + 2 * staffGap;

  // Playhead
  const emoji = cursorEmoji || '┃';
  ctx.fillStyle = cursorMotion === 'triangleJump' ? '#ea580c' : '#0d9488';
  ctx.font = '28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(emoji, playheadX, staffMidY - 8);
  ctx.strokeStyle = cursorMotion === 'triangleJump' ? '#ea580c' : '#0d9488';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(playheadX, staffTop - 10);
  ctx.lineTo(playheadX, staffTop + 4 * staffGap + 10);
  ctx.stroke();

  // Scene banner
  if (scene?.name) {
    ctx.fillStyle = 'rgba(15, 118, 110, 0.92)';
    roundRect(ctx, cardX + 24, cardY + cardH - 56, Math.min(360, cardW - 48), 36, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Stseen: ${scene.name}`, cardX + 40, cardY + cardH - 38);
  }

  // Footer timeline
  const barY = height - 70;
  ctx.fillStyle = '#e4e4e7';
  roundRect(ctx, 40, barY, width - 80, 18, 9);
  ctx.fill();
  ctx.fillStyle = '#0f766e';
  roundRect(ctx, 40, barY, Math.max(8, (mediaSec / Math.max(0.001, durationSec)) * (width - 80)), 18, 9);
  ctx.fill();

  ctx.fillStyle = '#52525b';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const timeLabel = `${formatTime(mediaSec)} / ${formatTime(durationSec)}`;
  ctx.fillText(timeLabel, 40, barY + 26);
  ctx.textAlign = 'right';
  ctx.fillText(`sync ${syncCount} · stseenid ${sceneCount}`, width - 40, barY + 26);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function formatTime(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

function resolveDurationSec(doc, audioDurationSec) {
  if (Number.isFinite(audioDurationSec) && audioDurationSec > 0.2) return audioDurationSec;
  const points = doc?.sync?.points || [];
  if (points.length) {
    const max = Math.max(...points.map((p) => Number(p.mediaSec) || 0));
    if (max > 0.2) return max + 2;
  }
  const scenes = doc?.scenes || [];
  if (scenes.length) {
    const max = Math.max(...scenes.map((s) => Number(s.endSec ?? s.startSec) || 0));
    if (max > 0.2) return max + 2;
  }
  return 15;
}

/**
 * Render montage presentation video.
 * @returns {Promise<{ blob: Blob, mimeType: string, ext: string, fileName: string, durationSec: number }>}
 */
export async function renderMontageVideo({
  doc,
  audioUrl = null,
  audioDurationSec = null,
  width = 1280,
  height = 720,
  fps = 24,
  onProgress = null,
  signal = null,
} = {}) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder pole selles brauseris saadaval.');
  }

  const durationSec = resolveDurationSec(doc, audioDurationSec);
  const { mimeType, ext } = pickRecorderMime();
  const stem = String(doc?.title || 'montaaz')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 60) || 'montaaz';
  const fileName = `${stem}.${ext}`;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D kontekst puudub.');

  const videoStream = canvas.captureStream(fps);
  let exportAudio = null;
  let audioStream = null;
  let audioCtx = null;
  let dest = null;

  if (audioUrl) {
    exportAudio = new Audio();
    exportAudio.crossOrigin = 'anonymous';
    exportAudio.src = audioUrl;
    exportAudio.preload = 'auto';
    await new Promise((resolve, reject) => {
      const onReady = () => resolve();
      const onErr = () => reject(new Error('Helifaili laadimine ebaõnnestus.'));
      if (exportAudio.readyState >= 2) resolve();
      else {
        exportAudio.addEventListener('canplaythrough', onReady, { once: true });
        exportAudio.addEventListener('error', onErr, { once: true });
      }
    }).catch(() => {});

    try {
      if (typeof exportAudio.captureStream === 'function') {
        audioStream = exportAudio.captureStream();
      }
    } catch { /* ignore */ }

    // Fallback: Web Audio destination capture (more reliable in some browsers)
    if (!audioStream || audioStream.getAudioTracks().length === 0) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaElementSource(exportAudio);
        dest = audioCtx.createMediaStreamDestination();
        src.connect(dest);
        src.connect(audioCtx.destination);
        audioStream = dest.stream;
        if (audioCtx.state === 'suspended') await audioCtx.resume();
      } catch { /* ignore */ }
    }
  }

  const tracks = [
    ...videoStream.getVideoTracks(),
    ...(audioStream ? audioStream.getAudioTracks() : []),
  ];
  const combined = new MediaStream(tracks);

  const recorder = new MediaRecorder(combined, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
    audioBitsPerSecond: audioStream ? 160_000 : undefined,
  });

  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  const cursor = doc?.playback?.cursor || {};
  const scoreLabel = doc?.score?.displayName
    || (doc?.score?.source === 'musicxml' ? 'MusicXML' : doc?.score?.source === 'noodimeister' ? 'Noodimeistri töö' : 'Partituur');

  const frameIntervalMs = 1000 / Math.max(1, fps);
  let frameTimer = null;
  let startWall = 0;

  const drawAt = (mediaSec) => {
    let progress = mediaSecToProgress(doc?.sync?.points, mediaSec, durationSec);
    const jumpMotion = cursor.motion === CURSOR_MOTION_JUMP
      || cursor.motion === CURSOR_MOTION_TRIANGLE_JUMP;
    if (jumpMotion && cursor.quantize?.enabled) {
      progress = quantizeProgress01(
        progress,
        estimateTotalBeatsFromDoc(doc),
        cursor.quantize
      );
    }
    const scene = activeSceneAt(doc?.scenes, mediaSec);
    drawFrame(ctx, {
      width,
      height,
      title: doc?.title,
      scoreLabel,
      mediaSec,
      durationSec,
      progress,
      cursorEmoji: cursor.emoji,
      cursorMotion: cursor.motion,
      scene,
      syncCount: (doc?.sync?.points || []).length,
      sceneCount: (doc?.scenes || []).length,
    });
  };

  // First frame before recording
  drawAt(0);

  const blobPromise = new Promise((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Video salvestamine ebaõnnestus.'));
    recorder.onstop = () => {
      try {
        const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
        resolve(blob);
      } catch (e) {
        reject(e);
      }
    };
  });

  recorder.start(250);
  startWall = performance.now();

  if (exportAudio) {
    try {
      exportAudio.currentTime = 0;
      await exportAudio.play();
    } catch { /* continue silent video */ }
  }

  await new Promise((resolve, reject) => {
    const tick = () => {
      if (signal?.aborted) {
        try { recorder.stop(); } catch { /* ignore */ }
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const elapsed = (performance.now() - startWall) / 1000;
      const mediaSec = clamp(elapsed, 0, durationSec);
      drawAt(mediaSec);
      if (typeof onProgress === 'function') {
        onProgress({ mediaSec, durationSec, ratio: mediaSec / durationSec });
      }
      if (elapsed >= durationSec) {
        clearInterval(frameTimer);
        resolve();
        return;
      }
    };
    frameTimer = setInterval(tick, frameIntervalMs);
    tick();
  });

  if (exportAudio) {
    try { exportAudio.pause(); } catch { /* ignore */ }
  }

  // Let last frames flush
  await new Promise((r) => setTimeout(r, 400));
  if (recorder.state === 'recording') recorder.stop();

  const blob = await blobPromise;

  // Cleanup
  try { videoStream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
  try { audioStream?.getTracks?.().forEach((t) => t.stop()); } catch { /* ignore */ }
  try { await audioCtx?.close?.(); } catch { /* ignore */ }

  if (!blob || blob.size < 100) {
    throw new Error('Renderitud video on tühi. Proovi teist brauserit või kontrolli helifaili.');
  }

  return {
    blob,
    mimeType: blob.type || mimeType.split(';')[0],
    ext,
    fileName,
    durationSec,
  };
}
