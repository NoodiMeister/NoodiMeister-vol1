/**
 * Montaaži videoredaktor (tööfaili all).
 * Kolm eraldi rida: 1) Helifail  2) Stseenid  3) Sync (+ playhead + quantize).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PLAYHEAD_QUANTIZE_GRIDS } from './playheadQuantize';

const MIN_SCENE_SEC = 0.25;
const TIMELINE_QUANTIZE_GRIDS = PLAYHEAD_QUANTIZE_GRIDS.filter((u) => u !== '1/1');

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function resolveSceneEnd(scene, scenesSorted, duration, index) {
  if (Number.isFinite(scene.endSec) && scene.endSec > scene.startSec) {
    return Math.min(duration, scene.endSec);
  }
  const next = scenesSorted[index + 1];
  if (next && Number.isFinite(next.startSec)) {
    return Math.max(scene.startSec + MIN_SCENE_SEC, Math.min(duration, next.startSec));
  }
  return duration > 0 ? duration : scene.startSec + 2;
}

export default function MontageTimeline({
  duration = 0,
  mediaTime = 0,
  playing = false,
  scenes = [],
  syncPoints = [],
  audioLabel = '',
  hasAudio = false,
  syncMeasureDraft = 0,
  onSeek,
  onUpdateScene,
  onAddSceneAt,
  onPickAudio,
  onAudioFiles,
  onAddSyncAt,
  onUpdateSync,
  onRemoveSync,
  quantizeEnabled = false,
  quantizeUnit = '1/4',
  onQuantizeChange,
  tr = (k, fb) => fb,
}) {
  const laneRef = useRef(null);
  const dragRef = useRef(null);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [selectedSyncId, setSelectedSyncId] = useState(null);
  const [audioDragOver, setAudioDragOver] = useState(false);

  const safeDuration = duration > 0 ? duration : Math.max(mediaTime + 1, 30);

  const scenesSorted = useMemo(
    () => [...(scenes || [])].sort((a, b) => (a.startSec || 0) - (b.startSec || 0)),
    [scenes]
  );

  const activeSceneId = useMemo(() => {
    for (let i = scenesSorted.length - 1; i >= 0; i -= 1) {
      const s = scenesSorted[i];
      const start = Number(s.startSec) || 0;
      const end = resolveSceneEnd(s, scenesSorted, safeDuration, i);
      if (mediaTime >= start - 1e-3 && mediaTime < end + 1e-3) return s.id;
    }
    return null;
  }, [scenesSorted, mediaTime, safeDuration]);

  const pct = (sec) => clamp((Number(sec) || 0) / safeDuration, 0, 1) * 100;

  const clientXToSec = useCallback((clientX) => {
    const el = laneRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    return ratio * safeDuration;
  }, [safeDuration]);

  const seekFromEvent = (e) => {
    if (dragRef.current) return;
    onSeek?.(clientXToSec(e.clientX));
  };

  const beginSceneDrag = (e, scene, mode) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSceneId(scene.id);
    const startSec0 = Number(scene.startSec) || 0;
    const idx = scenesSorted.findIndex((s) => s.id === scene.id);
    const endSec0 = resolveSceneEnd(scene, scenesSorted, safeDuration, idx);
    dragRef.current = {
      kind: 'scene',
      mode,
      sceneId: scene.id,
      originX: e.clientX,
      startSec0,
      endSec0,
      hasExplicitEnd: Number.isFinite(scene.endSec) && scene.endSec > scene.startSec,
    };
    bindDrag();
  };

  const beginSyncDrag = (e, point) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSyncId(point.id);
    dragRef.current = {
      kind: 'sync',
      pointId: point.id,
      originX: e.clientX,
      mediaSec0: Number(point.mediaSec) || 0,
    };
    bindDrag();
  };

  const bindDrag = () => {
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const deltaSec = clientXToSec(ev.clientX) - clientXToSec(d.originX);
      if (d.kind === 'scene') {
        if (d.mode === 'move') {
          const span = Math.max(MIN_SCENE_SEC, d.endSec0 - d.startSec0);
          const nextStart = clamp(d.startSec0 + deltaSec, 0, Math.max(0, safeDuration - span));
          const nextEnd = nextStart + span;
          onUpdateScene?.(d.sceneId, {
            startSec: nextStart,
            endSec: d.hasExplicitEnd || nextEnd < safeDuration - 0.05 ? nextEnd : null,
          });
        } else if (d.mode === 'resize-start') {
          const nextStart = clamp(d.startSec0 + deltaSec, 0, d.endSec0 - MIN_SCENE_SEC);
          onUpdateScene?.(d.sceneId, { startSec: nextStart, endSec: d.endSec0 });
        } else if (d.mode === 'resize-end') {
          const nextEnd = clamp(d.endSec0 + deltaSec, d.startSec0 + MIN_SCENE_SEC, safeDuration);
          onUpdateScene?.(d.sceneId, { startSec: d.startSec0, endSec: nextEnd });
        }
      } else if (d.kind === 'sync') {
        const nextSec = clamp(d.mediaSec0 + deltaSec, 0, safeDuration);
        onUpdateSync?.(d.pointId, { mediaSec: nextSec });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const tickCount = Math.min(12, Math.max(4, Math.ceil(safeDuration / 5)));
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (i / tickCount) * safeDuration);

  const acceptAudioDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setAudioDragOver(false);
    const files = e.dataTransfer?.files;
    if (files?.length && onAudioFiles) onAudioFiles(files);
  };

  const Playhead = () => (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-teal-700 z-20 pointer-events-none"
      style={{ left: `${pct(mediaTime)}%` }}
    />
  );

  return (
    <section
      className="border-t border-zinc-300 bg-zinc-100 flex flex-col min-h-[200px] max-h-[48vh]"
      aria-label={tr('studio.videoEditorTitle', 'Videoredaktor')}
    >
      <div className="px-4 py-2 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white">
        <h2 className="text-xs font-bold uppercase tracking-wide text-zinc-600">
          {tr('studio.videoEditorTitle', 'Videoredaktor')}
        </h2>
        <span className="text-[11px] text-zinc-500">
          {tr('studio.videoEditorHint', 'Tööfaili all — heli rida · stseenide rida · sync rida.')}
        </span>
        <button
          type="button"
          onClick={() => onPickAudio?.()}
          className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-sky-600 text-sky-900 bg-sky-50 hover:bg-sky-100"
        >
          {hasAudio
            ? tr('studio.timelineReplaceAudio', 'Vaheta helifail')
            : tr('studio.timelineAddAudio', 'Kanna helifail')}
        </button>
        <button
          type="button"
          onClick={() => onAddSceneAt?.(mediaTime)}
          className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-amber-600 text-amber-950 bg-amber-50 hover:bg-amber-100"
        >
          {tr('studio.timelineAddScene', 'Lisa stseen playhead’ile')}
        </button>
        <button
          type="button"
          onClick={() => onAddSyncAt?.(mediaTime, Number(syncMeasureDraft) || 0)}
          className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-violet-600 text-violet-950 bg-violet-50 hover:bg-violet-100"
        >
          {tr('studio.timelineAddSync', 'Lisa sync playhead’ile')}
        </button>

        <div className="flex flex-wrap items-center gap-1.5 ml-1 pl-2 border-l border-zinc-200">
          <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            {tr('studio.timelineQuantize', 'Quantize')}
          </span>
          <label className="inline-flex items-center gap-1 text-[11px] text-zinc-700 cursor-pointer">
            <input
              type="checkbox"
              checked={!!quantizeEnabled}
              onChange={(e) => onQuantizeChange?.({ enabled: e.target.checked })}
            />
            {tr('studio.quantizeOn', 'Sees')}
          </label>
          {TIMELINE_QUANTIZE_GRIDS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => onQuantizeChange?.({ unit: u, enabled: true })}
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                quantizeEnabled && quantizeUnit === u
                  ? 'bg-teal-700 text-white border-teal-800'
                  : 'bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50'
              }`}
              title={tr('studio.timelineQuantizeHint', 'Rütmivõre: kui tihedalt playhead hüppab')}
            >
              {u}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[11px] font-mono text-zinc-600 tabular-nums">
          {formatTime(mediaTime)} / {formatTime(safeDuration)}
          {playing ? ` · ${tr('studio.playing', 'mängib')}` : ''}
        </span>
      </div>

      <div className="flex-1 overflow-auto px-3 py-2">
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-2 min-w-[520px]">
          {/* Time ruler */}
          <div className="text-[10px] text-zinc-400 self-end pb-0.5">{tr('studio.timelineTime', 'Aeg')}</div>
          <div ref={laneRef} className="relative h-5 border-b border-zinc-300">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-0 text-[10px] text-zinc-500 -translate-x-1/2"
                style={{ left: `${pct(t)}%` }}
              >
                {formatTime(t)}
              </span>
            ))}
          </div>

          {/* ROW 1 — Audio */}
          <div className="text-[10px] font-bold text-sky-900 self-center leading-tight">
            <div>{tr('studio.timelineAudioRow', '1 · Heli')}</div>
            <div className="font-normal text-zinc-500 truncate" title={audioLabel}>{audioLabel || '—'}</div>
          </div>
          <div
            className={`relative h-10 rounded-md border cursor-pointer overflow-hidden ${
              audioDragOver ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-300' : 'border-sky-300 bg-sky-50/40'
            }`}
            onClick={(e) => {
              if (!hasAudio && onPickAudio) {
                onPickAudio();
                return;
              }
              seekFromEvent(e);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAudioDragOver(true);
            }}
            onDragLeave={() => setAudioDragOver(false)}
            onDrop={acceptAudioDrop}
            role="presentation"
            title={hasAudio ? audioLabel : tr('studio.timelineDropAudio', 'Klõpsa või lohista helifail siia')}
          >
            {hasAudio ? (
              <div
                className="absolute inset-y-1.5 left-0 right-0 mx-0 rounded bg-sky-300/70 border border-sky-500/40"
                style={{ width: '100%' }}
              />
            ) : (
              <p className="absolute inset-0 flex items-center justify-center text-[10px] text-sky-900 font-medium px-2 text-center">
                {tr('studio.timelineDropAudio', 'Klõpsa või lohista helifail siia')}
              </p>
            )}
            <Playhead />
          </div>

          {/* ROW 2 — Scenes */}
          <div className="text-[10px] font-bold text-amber-950 self-center leading-tight">
            <div>{tr('studio.timelineScenesRow', '2 · Stseenid')}</div>
            <div className="font-normal text-zinc-500">{(scenes || []).length}</div>
          </div>
          <div
            className="relative h-12 rounded-md border border-amber-300 bg-amber-50/30 cursor-pointer overflow-hidden"
            onClick={(e) => {
              if (e.target.closest('[data-timeline-scene]')) return;
              seekFromEvent(e);
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              onAddSceneAt?.(clientXToSec(e.clientX));
            }}
            role="presentation"
            title={tr('studio.timelineScenesHint', 'Topeltklõps: lisa stseen. Lohista / venita kaste.')}
          >
            {scenesSorted.length === 0 ? (
              <p className="absolute inset-0 flex items-center justify-center text-[10px] text-amber-900/70 pointer-events-none px-2 text-center">
                {tr('studio.timelineNoScenes', 'Lisa stseen nupuga või topeltklõpsuga')}
              </p>
            ) : (
              scenesSorted.map((scene, index) => {
                const start = Number(scene.startSec) || 0;
                const end = resolveSceneEnd(scene, scenesSorted, safeDuration, index);
                const left = pct(start);
                const width = Math.max(0.8, pct(end) - left);
                const isActive = scene.id === activeSceneId;
                const isSelected = scene.id === selectedSceneId;
                return (
                  <div
                    key={scene.id}
                    data-timeline-scene
                    className={`absolute top-1.5 bottom-1.5 rounded border text-[10px] font-semibold flex items-center px-1.5 overflow-hidden select-none ${
                      isActive
                        ? 'bg-teal-600 text-white border-teal-800 shadow-sm z-[5]'
                        : isSelected
                          ? 'bg-amber-300 text-amber-950 border-amber-600 z-[4]'
                          : 'bg-amber-200 text-amber-950 border-amber-400 hover:bg-amber-100 z-[3]'
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${scene.name} · ${formatTime(start)}–${formatTime(end)}`}
                    onPointerDown={(e) => beginSceneDrag(e, scene, 'move')}
                  >
                    <span
                      className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/10 hover:bg-black/25"
                      onPointerDown={(e) => beginSceneDrag(e, scene, 'resize-start')}
                      aria-hidden
                    />
                    <span className="truncate pointer-events-none pl-1">{scene.name || '—'}</span>
                    <span
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-black/10 hover:bg-black/25"
                      onPointerDown={(e) => beginSceneDrag(e, scene, 'resize-end')}
                      aria-hidden
                    />
                  </div>
                );
              })
            )}
            <Playhead />
          </div>

          {/* ROW 3 — Sync (in video editor) */}
          <div className="text-[10px] font-bold text-violet-950 self-center leading-tight">
            <div>{tr('studio.timelineSyncRow', '3 · Sync')}</div>
            <div className="font-normal text-zinc-500">
              M{Number(syncMeasureDraft) || 0} · {(syncPoints || []).length}
            </div>
          </div>
          <div
            className="relative h-10 rounded-md border border-violet-300 bg-violet-50/40 cursor-crosshair overflow-hidden"
            onClick={(e) => {
              if (e.target.closest('[data-timeline-sync]')) return;
              const sec = clientXToSec(e.clientX);
              onSeek?.(sec);
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              const sec = clientXToSec(e.clientX);
              onSeek?.(sec);
              onAddSyncAt?.(sec, Number(syncMeasureDraft) || 0);
            }}
            role="presentation"
            title={tr('studio.timelineSyncHint', 'Topeltklõps: lisa sync. Lohista ankrut. Delete: eemalda valitud.')}
          >
            {(syncPoints || []).length === 0 ? (
              <p className="absolute inset-0 flex items-center justify-center text-[10px] text-violet-900/70 pointer-events-none px-2 text-center">
                {tr('studio.timelineNoSync', 'Topeltklõps sync-reale või nupp „Lisa sync“')}
              </p>
            ) : null}
            {(syncPoints || []).map((p) => {
              const selected = p.id === selectedSyncId;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-timeline-sync
                  className={`absolute top-1 bottom-1 w-3 -ml-1.5 rounded-sm z-[3] flex flex-col items-center ${
                    selected ? 'bg-violet-700 ring-2 ring-violet-400' : 'bg-violet-500 hover:bg-violet-600'
                  }`}
                  style={{ left: `${pct(p.mediaSec)}%` }}
                  title={`M${p.measureIndex} @ ${formatTime(p.mediaSec)} — ${tr('studio.timelineSyncDrag', 'lohista')}`}
                  onPointerDown={(e) => beginSyncDrag(e, p)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSyncId(p.id);
                    onSeek?.(Number(p.mediaSec) || 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      onRemoveSync?.(p.id);
                    }
                  }}
                >
                  <span className="text-[8px] leading-none text-white font-bold mt-0.5">M{p.measureIndex}</span>
                </button>
              );
            })}
            <Playhead />
          </div>
        </div>
      </div>
    </section>
  );
}
