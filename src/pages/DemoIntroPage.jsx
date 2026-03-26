import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INTRO_TO_LANDING_CROSSFADE_MS, useIntroCrossfade } from '../context/IntroCrossfadeContext';

const BUILD_TAG = '20260325-demo-intro-beam5-mirror-lb-v29';
const AUDIO_SRC = `/demo-intro.mp3?v=${BUILD_TAG}`;
const LOGO_SRC = `/logo-overlay.html?v=${BUILD_TAG}`;
/**
 * Crossfade: delay step 0.1·T so at global t=k·T+0.15T fading beam is at 15% (mid-fall) and next at 5% (mid-rise) → same opacity (linear).
 * Pulse first 20% of T; 20–100% stable dim (keyframes 0%/20%/100% same opacity → seamless infinite loop). +2s per beam → T = 17200 + 5×2000. Order 1→4→2→5→3.
 */
const BEAM_PULSE_MS = 27200;
const BEAM_PULSE_HANDOFF_MS = BEAM_PULSE_MS * 0.1;
const BEAM_PULSE_DELAY_BY_KEY_MS = {
  lb: 0,
  rt: BEAM_PULSE_HANDOFF_MS * 1,
  lt: BEAM_PULSE_HANDOFF_MS * 2,
  rb: BEAM_PULSE_HANDOFF_MS * 3,
  tc: BEAM_PULSE_HANDOFF_MS * 4
};
/* lb (beam 1, vasak alla): varasem täislai trapets — ülemine paralleel 28–72% @ 44%. rb (beam 5, parem alla): eraldi trapets (vt clip). lt/rt: nurgast üles. */
const BEAM_STYLES = [
  {
    key: 'lb',
    background:
      'linear-gradient(90deg, rgba(255,248,232,0) 0%, rgba(255,248,232,0) 38%, rgba(28,18,8,0.14) 68%, rgba(14,9,4,0.38) 100%), radial-gradient(ellipse 95% 78% at 0% 100%, rgba(255,248,224,0.62) 0%, rgba(255,212,150,0.28) 34%, transparent 68%), linear-gradient(32deg, rgba(255,244,212,0) 0%, rgba(255,244,212,0.66) 12%, rgba(255,214,144,0.44) 44%, rgba(255,180,90,0.16) 68%, rgba(0,0,0,0) 100%)',
    clipPath: 'polygon(0% 100%, 5% 100%, 72% 44%, 28% 44%)'
  },
  {
    key: 'lt',
    background:
      'linear-gradient(124deg, rgba(255,248,232,0) 0%, rgba(255,248,232,0) 40%, rgba(28,18,8,0.12) 74%, rgba(14,9,4,0.36) 100%), radial-gradient(ellipse 88% 80% at 0% 0%, rgba(255,248,224,0.58) 0%, rgba(255,214,155,0.26) 36%, transparent 70%), linear-gradient(14deg, rgba(255,244,212,0) 0%, rgba(255,244,212,0.62) 12%, rgba(255,214,144,0.38) 42%, rgba(255,190,110,0.16) 66%, rgba(0,0,0,0) 100%)',
    clipPath: 'polygon(0% -5%, 2% 0.5%, 63% 50.5%, 25% 68%)'
  },
  {
    key: 'tc',
    background:
      'linear-gradient(180deg, rgba(255,252,240,0) 0%, rgba(255,252,240,0) 36%, rgba(28,18,8,0.12) 72%, rgba(14,9,4,0.34) 100%), radial-gradient(ellipse 120% 70% at 50% 0%, rgba(255,252,232,0.55) 0%, rgba(255,220,160,0.24) 38%, transparent 72%), linear-gradient(180deg, rgba(255,250,226,0) 0%, rgba(255,250,226,0.68) 18%, rgba(255,220,152,0.36) 52%, rgba(255,185,95,0.14) 76%, rgba(0,0,0,0) 100%)',
    clipPath: 'polygon(49.4% 0%, 50.6% 0%, 74% 62%, 26% 62%)'
  },
  {
    key: 'rt',
    background:
      'linear-gradient(236deg, rgba(255,248,232,0) 0%, rgba(255,248,232,0) 40%, rgba(28,18,8,0.12) 74%, rgba(14,9,4,0.36) 100%), radial-gradient(ellipse 88% 80% at 100% 0%, rgba(255,248,224,0.58) 0%, rgba(255,214,155,0.26) 36%, transparent 70%), linear-gradient(346deg, rgba(255,244,212,0) 0%, rgba(255,244,212,0.62) 12%, rgba(255,214,144,0.38) 42%, rgba(255,190,110,0.16) 66%, rgba(0,0,0,0) 100%)',
    clipPath: 'polygon(100% 0%, 97.5% 0%, 37% 50.5%, 75% 68%)'
  },
  {
    key: 'rb',
    background:
      'linear-gradient(270deg, rgba(255,248,232,0) 0%, rgba(255,248,232,0) 38%, rgba(28,18,8,0.14) 68%, rgba(14,9,4,0.38) 100%), radial-gradient(ellipse 95% 78% at 100% 100%, rgba(255,248,224,0.62) 0%, rgba(255,212,150,0.28) 34%, transparent 68%), linear-gradient(328deg, rgba(255,244,212,0) 0%, rgba(255,244,212,0.66) 12%, rgba(255,214,144,0.44) 44%, rgba(255,180,90,0.16) 68%, rgba(0,0,0,0) 100%)',
    clipPath: 'polygon(100% 100%, 95% 100%, 28% 44%, 72% 44%)'
  }
];

/** Same delays as BY_KEY, in BEAM_STYLES order (for index-based map). */
const BEAM_PULSE_DELAY_MS = BEAM_STYLES.map((b) => BEAM_PULSE_DELAY_BY_KEY_MS[b.key] ?? 0);

export default function DemoIntroPage() {
  const { startCrossfade } = useIntroCrossfade();
  const audioRef = useRef(null);
  const [phase, setPhase] = useState('enter'); // enter -> playing -> ended -> exit
  const [needsGesture, setNeedsGesture] = useState(false);
  const [error, setError] = useState('');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const projectorDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('verifyProjector') === '1';

  const isExiting = phase === 'exit';
  const showTapToStart = needsGesture && (phase === 'enter' || phase === 'playing');

  const helpText = useMemo(() => {
    if (error) return error;
    if (isExiting) return '...';
    if (phase === 'ended') return 'Vajuta SPACE, et jätkata';
    if (showTapToStart || !audioPlaying) return 'Klõpsa või vajuta SPACE, et alustada heli';
    return 'Intro…';
  }, [audioPlaying, error, isExiting, phase, showTapToStart]);

  const startPlayback = async () => {
    const el = audioRef.current;
    if (!el) return;
    try {
      setError('');
      setNeedsGesture(false);
      setPhase((p) => (p === 'enter' ? 'playing' : p));
      await el.play();
      setAudioPlaying(true);
    } catch (e) {
      // Mobile Safari blocks autoplay without gesture.
      setNeedsGesture(true);
      setPhase('playing');
      setAudioPlaying(false);
    }
  };

  const beginExit = useCallback(() => {
    if (phase !== 'ended') return;
    setPhase('exit');
    startCrossfade(INTRO_TO_LANDING_CROSSFADE_MS);
  }, [phase, startCrossfade]);

  useEffect(() => {
    // Try autoplay on mount; if blocked, we’ll show a tap-to-start hint.
    startPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      // Don’t hijack when the user is typing into inputs (defensive).
      const el = e.target;
      const tag = el?.tagName;
      const isTypingTarget = tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable;
      if (isTypingTarget) return;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (phase === 'ended') {
          beginExit();
        }
        else startPlayback();
      }
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [beginExit, phase, showTapToStart]);

  return (
    <div
      className={`nm-demo-intro nm-demo-intro--${phase} ${isExiting ? 'nm-demo-intro--exit nm-demo-intro--exit-crossfade' : ''}`}
      style={{ '--nm-demo-crossfade-ms': `${INTRO_TO_LANDING_CROSSFADE_MS}ms` }}
      role="dialog"
      aria-label="Demo intro"
      onMouseDown={() => {
        const el = audioRef.current;
        if (showTapToStart || (el && el.paused && (phase === 'enter' || phase === 'playing'))) startPlayback();
      }}
      onTouchStart={() => {
        const el = audioRef.current;
        if (showTapToStart || (el && el.paused && (phase === 'enter' || phase === 'playing'))) startPlayback();
      }}
    >
      <audio
        ref={audioRef}
        src={AUDIO_SRC}
        preload="auto"
        playsInline
        onCanPlay={() => {
          setError('');
        }}
        onError={() => setError('Intro heli ei õnnestunud laadida. Kontrolli, et fail oleks public kaustas nimega demo-intro.mp3')}
        onPlay={() => setAudioPlaying(true)}
        onPause={() => setAudioPlaying(false)}
        onEnded={() => {
          setAudioPlaying(false);
          setPhase('ended');
        }}
      />

      <div className="nm-demo-intro__bg" aria-hidden="true" />
      <div className="nm-demo-intro__stage-glow" aria-hidden="true" />
      <div
        className="nm-demo-intro__projector-rig"
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen' }}
      >
        {BEAM_STYLES.map((beam, i) => (
          <div
            key={beam.key}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.26,
              background: beam.background,
              clipPath: beam.clipPath,
              filter: 'blur(0.18px)',
              animation: `nmBeamPulse ${BEAM_PULSE_MS}ms linear infinite`,
              animationDelay: `${BEAM_PULSE_DELAY_MS[i] ?? 0}ms`
            }}
          />
        ))}
      </div>

      <div className="nm-demo-intro__content">
        {projectorDebug && (
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              zIndex: 5,
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.24)',
              background: 'rgba(16, 42, 56, 0.85)',
              color: '#d8f7ff'
            }}
          >
            PROJECTOR MODE: 5-BEAMS ACTIVE
          </div>
        )}
        <div className="nm-demo-intro__logo-stage">
          <iframe
            className="nm-demo-intro__logo nm-demo-intro__logo-embed"
            src={LOGO_SRC}
            title="Noodimeister"
            aria-label="Noodimeister"
          />
        </div>
        <div className="nm-demo-intro__hint" aria-live="polite">
          {helpText}
        </div>
      </div>
    </div>
  );
}

