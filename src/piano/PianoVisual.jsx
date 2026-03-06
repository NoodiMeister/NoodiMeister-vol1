/**
 * PianoVisual – visuaalne klaverikomponent.
 * Värvid ja kujundid: FIGURE_SHAPES_DATA (C=punane ruut, D=pruun ring, E=kollane kolmnurk, F=roheline, G=sinine täht, A=lilla romb, B=valge ovaal).
 * Oktav 2–3: tumedus/rist; oktav 5: must piirjoon; oktav 6: värviline raam. Tavarežiimis (Leland) figurenotesColors=null → klassikaline must-valge.
 */

import React, { useMemo } from 'react';
import { getKeysInRange } from './pianoKeys.js';
import { getJoName } from '../notation/joNames';
import { getFigureSymbol } from '../utils/figurenotes';
import { getShapeData, getFigureStyle } from '../constants/FigureNotesLibrary';
import './PianoVisual.css';

const BLACK_WIDTH_RATIO = 0.6;
const NATURAL_PITCH_BY_MIDI_MOD = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
/** Mustad klahvid: MIDI mod 12 -> kas kõrgendus (#) või madaldus (b). Vaikimisi #. */
const BLACK_KEY_ACCIDENTAL = { 1: 'sharp', 3: 'sharp', 6: 'sharp', 8: 'sharp', 10: 'sharp' };

/** Teaduslik oktaav MIDI numbrist (C4 = 60 → 4). */
function midiToOctave(midi) {
  return Math.floor(midi / 12) - 1;
}

/**
 * Figurenotes kujund klahvidel: noodinime + oktaav.
 * Kui octave on antud, rakendatakse getFigureStyle (oktav 5 = must raam, oktav 3 = tumedam jne).
 */
function FigureKeyPath({ pitch, color, size = 14, className = '', octave }) {
  const data = getShapeData(pitch);
  const style = octave != null ? getFigureStyle(pitch, octave) : { fill: color };
  const fill = style.fill ?? data.color ?? color;
  const stroke = style.stroke ?? data.stroke ?? 'none';
  const strokeWidth = style.strokeWidth ?? (data.stroke ? 3 : 0);
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ opacity: style.opacity ?? 1 }}>
      <path d={data.path} fill={fill} stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      {style.showCross && (
        <g stroke="#000" strokeWidth={Math.max(2, strokeWidth || 2)} strokeLinecap="round" vectorEffect="non-scaling-stroke">
          <line x1="10" y1="10" x2="90" y2="90" />
          <line x1="90" y1="10" x2="10" y2="90" />
        </g>
      )}
    </svg>
  );
}

/** Väike figuuri kujund klahvidel (SVG). shape: none | cross | square | circle | triangle | triangleDown. Kasutatakse kui path-based pole. */
function FigureKeyShape({ shape, color, size = 14, className = '' }) {
  const r = size / 2;
  const strokeW = Math.max(1.5, size * 0.2);
  if (shape === 'none') {
    return <span className={className} style={{ display: 'inline-block', width: size, height: size, border: '1px dashed rgba(0,0,0,0.3)', borderRadius: 2 }} aria-hidden="true" />;
  }
  if (shape === 'cross') {
    return (
      <svg className={className} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <line x1={0} y1={0} x2={size} y2={size} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
        <line x1={size} y1={0} x2={0} y2={size} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
        <rect x={0} y={0} width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.4} />
      </svg>
    );
  }
  if (shape === 'square') {
    return (
      <svg className={className} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <rect x={0} y={0} width={size} height={size} fill={color} stroke="currentColor" strokeWidth={1} opacity={0.5} />
      </svg>
    );
  }
  if (shape === 'circle') {
    return (
      <svg className={className} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={r} cy={r} r={r - 1} fill={color} stroke="currentColor" strokeWidth={1} opacity={0.5} />
      </svg>
    );
  }
  if (shape === 'triangle') {
    const h = size * 0.866;
    return (
      <svg className={className} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <path d={`M ${r} 1 L ${size - 1} ${size - 1} L 1 ${size - 1} Z`} fill={color} stroke="currentColor" strokeWidth={1} opacity={0.5} />
      </svg>
    );
  }
  if (shape === 'triangleDown') {
    return (
      <svg className={className} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <path d={`M ${r} ${size - 1} L ${size - 1} 1 L 1 1 Z`} fill={color} stroke="currentColor" strokeWidth={1} opacity={0.5} />
      </svg>
    );
  }
  return null;
}

export function PianoVisual({
  firstNote = 48,
  lastNote = 72,
  activeNotes = [],
  onPlayNote,
  onStopNote,
  className = '',
  width = 600,
  height = 160,
  /** Figuurnotatsioon: värviallikas FIGURE_SHAPES_DATA (C, D, …). Null = tavarežiim, klassikaline must-valge klaver. */
  figurenotesColors = null,
  /** Pedagoogiline: (natural, octave) => hex – värv JO suhtes; kui antud, kasutatakse getKeyColor asemel figurenotesColors */
  getKeyColor = null,
  /** Helistik JO/LE teksti jaoks (nt 'C', 'F') */
  keySignature = 'C',
}) {
  const { white, black } = useMemo(
    () => getKeysInRange(firstNote, lastNote),
    [firstNote, lastNote]
  );

  const whiteWidth = white.length > 0 ? 100 / white.length : 0;
  const blackWidthPct = whiteWidth * BLACK_WIDTH_RATIO;
  const activeSet = useMemo(() => new Set(activeNotes), [activeNotes]);
  const useFigurenotes = (figurenotesColors && Object.keys(figurenotesColors).length > 0) || typeof getKeyColor === 'function';

  const handlePointerDown = (e, midi) => {
    e.preventDefault();
    onPlayNote?.(midi);
  };

  const handlePointerUp = (e, midi) => {
    e.preventDefault();
    onStopNote?.(midi);
  };

  const handlePointerLeave = (e, midi) => {
    if (e.buttons !== 0) onStopNote?.(midi);
  };

  const getWhiteKeyStyle = (midi) => {
    const base = { width: `${whiteWidth}%` };
    if (!useFigurenotes) return base;
    const natural = NATURAL_PITCH_BY_MIDI_MOD[midi % 12];
    if (!natural) return base;
    const octave = midiToOctave(midi);
    const fillColor = typeof getKeyColor === 'function'
      ? getKeyColor(natural, octave)
      : (getFigureStyle(natural, octave).fill ?? figurenotesColors?.[natural]);
    if (!fillColor) return base;
    const textColor = natural === 'A' || natural === 'E' ? '#000000' : '#ffffff';
    return {
      ...base,
      ['--piano-figurenotes-color']: fillColor,
      ['--piano-figurenotes-text']: textColor,
    };
  };

  const getJoLabel = (midi) => {
    if (!useFigurenotes || !keySignature) return null;
    const natural = NATURAL_PITCH_BY_MIDI_MOD[midi % 12];
    if (!natural) return null;
    const octave = Math.floor(midi / 12) - 1;
    return getJoName(natural, octave, keySignature);
  };

  /** Valge klahvi figuur: noodinime + oktaav (sama oktaavireegel nagu noodijoonestikul). */
  const getWhiteKeyFigure = (midi) => {
    if (!useFigurenotes) return null;
    const natural = NATURAL_PITCH_BY_MIDI_MOD[midi % 12];
    if (!natural) return null;
    const octave = midiToOctave(midi);
    const data = getShapeData(natural);
    return { pitch: natural, color: data.color, stroke: data.stroke, octave };
  };

  /** Musta klahvi figuur: noodinime + oktaav + nool (kõrgendus/madaldus). */
  const getBlackKeyFigure = (midi) => {
    if (!useFigurenotes) return null;
    const mod = midi % 12;
    const naturalForColor = { 1: 'C', 3: 'D', 6: 'F', 8: 'G', 10: 'A' }[mod];
    if (!naturalForColor) return null;
    const octave = midiToOctave(midi);
    const data = getShapeData(naturalForColor);
    const useFlat = keySignature === 'F' || keySignature === 'Bb' || keySignature === 'Eb';
    const arrow = BLACK_KEY_ACCIDENTAL[mod] ? (useFlat ? 'flat' : 'sharp') : 'sharp';
    return { pitch: naturalForColor, color: data.color, stroke: data.stroke, arrow, octave };
  };

  return (
    <div
      className={`PianoVisual ${className}`.trim()}
      style={{ width, height }}
      role="application"
      aria-label="Klaver"
    >
      <div className="PianoVisual__keys">
        <div className="PianoVisual__white-row">
          {white.map(({ midi }) => (
            <button
              key={midi}
              type="button"
              className={`PianoVisual__key PianoVisual__key--white ${activeSet.has(midi) ? 'PianoVisual__key--active' : ''} ${useFigurenotes ? 'PianoVisual__key--figurenotes' : ''}`}
              style={getWhiteKeyStyle(midi)}
              onPointerDown={(e) => handlePointerDown(e, midi)}
              onPointerUp={(e) => handlePointerUp(e, midi)}
              onPointerLeave={(e) => handlePointerLeave(e, midi)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {useFigurenotes && (() => {
                const fig = getWhiteKeyFigure(midi);
                if (!fig) return null;
                return (
                  <>
                    <FigureKeyPath pitch={fig.pitch} color={fig.color} size={14} className="PianoVisual__key-figure" octave={fig.octave} />
                    {getJoLabel(midi) && (
                      <span className="PianoVisual__key-label" style={{ color: 'var(--piano-figurenotes-text)' }}>
                        {getJoLabel(midi)}
                      </span>
                    )}
                  </>
                );
              })()}
            </button>
          ))}
        </div>
        <div className="PianoVisual__black-row">
          {black.map(({ midi, whiteIndex }) => {
            const fig = getBlackKeyFigure(midi);
            return (
              <button
                key={midi}
                type="button"
                className={`PianoVisual__key PianoVisual__key--black ${activeSet.has(midi) ? 'PianoVisual__key--active' : ''} ${fig ? 'PianoVisual__key--figurenotes' : ''}`}
                style={{
                  width: `${blackWidthPct}%`,
                  left: `${whiteIndex * whiteWidth + whiteWidth - blackWidthPct / 2}%`,
                  ...(fig && { ['--piano-figurenotes-color']: fig.color }),
                }}
                data-arrow={fig?.arrow}
                onPointerDown={(e) => handlePointerDown(e, midi)}
                onPointerUp={(e) => handlePointerUp(e, midi)}
                onPointerLeave={(e) => handlePointerLeave(e, midi)}
                onContextMenu={(e) => e.preventDefault()}
              >
                {fig && (
                  <span className="PianoVisual__black-figure" style={{ backgroundColor: fig.color }}>
                    <FigureKeyPath pitch={fig.pitch} color="#fff" size={12} className="PianoVisual__black-shape" octave={fig.octave} />
                    <span className="PianoVisual__black-arrow" aria-hidden="true">
                      {fig.arrow === 'flat' ? '↖' : '↗'}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
