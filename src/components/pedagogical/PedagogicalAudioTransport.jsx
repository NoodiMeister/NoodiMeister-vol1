import React from 'react';

/**
 * Ühised MP3/video editori transportnupud (play/paus, stop, ±seek).
 * Üks HTMLAudioElement + sama callbackid kõikjal — vältib lahknevat käitumist.
 */
const STYLES = {
  panel: {
    row: 'inline-flex items-center gap-2 flex-wrap',
    play: 'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500',
    stop: 'inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-200 text-slate-900 text-sm font-semibold hover:bg-slate-300 border border-slate-300',
    seek: 'inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-100 text-violet-900 text-sm font-semibold hover:bg-violet-200 border border-violet-300',
    iconInPlay: true,
    iconClass: 'w-4 h-4',
  },
  teacher: {
    row: 'flex flex-wrap items-center gap-2',
    play: 'px-2 py-1 rounded text-sm bg-violet-600 text-white hover:bg-violet-500',
    stop: 'px-2 py-1 rounded text-sm bg-slate-200 text-slate-900 hover:bg-slate-300 border border-slate-300',
    seek: 'px-2 py-1 rounded text-sm bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200',
    iconInPlay: true,
    iconClass: 'w-4 h-4 inline-block mr-1',
  },
  videoToolbar: {
    row: 'flex items-center gap-1.5',
    play: 'px-2 py-1 rounded text-xs bg-violet-600 text-white hover:bg-violet-500',
    stop: 'px-2 py-1 rounded text-xs bg-slate-200 text-slate-900 hover:bg-slate-300 border border-slate-300',
    seek: 'px-2 py-1 rounded text-xs bg-violet-100 text-violet-900 hover:bg-violet-200 border border-violet-300',
    iconInPlay: false,
    iconClass: 'w-4 h-4',
  },
};

export function PedagogicalAudioTransport({
  variant = 'panel',
  isPlaying,
  playLabel,
  pauseLabel,
  stopLabel = 'Stop',
  rewindLabel,
  forwardLabel,
  onPlayPause,
  onStop,
  onSeekBack,
  onSeekForward,
  PlayIcon,
  PauseIcon,
  className = '',
}) {
  const s = STYLES[variant] || STYLES.panel;
  return (
    <div className={`${s.row} ${className}`.trim()}>
      <button type="button" onClick={onPlayPause} className={s.play}>
        {s.iconInPlay && PlayIcon && !isPlaying && <PlayIcon className={s.iconClass} />}
        {s.iconInPlay && PauseIcon && isPlaying && <PauseIcon className={s.iconClass} />}
        {isPlaying ? pauseLabel : playLabel}
      </button>
      <button type="button" onClick={onStop} className={s.stop}>
        {stopLabel}
      </button>
      <button type="button" onClick={onSeekBack} className={s.seek}>
        {rewindLabel}
      </button>
      <button type="button" onClick={onSeekForward} className={s.seek}>
        {forwardLabel}
      </button>
    </div>
  );
}
