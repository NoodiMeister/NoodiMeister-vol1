/**
 * PianoVisual – visuaalne klaverikomponent.
 * Figuurnotatsioon: valged klahvid värviskeemi järgi, JO/LE tekst kujundi sees;
 * mustad klahvid tumedaks, kujund noolega (↗ kõrgendus, ↖ madaldus).
 */

import React, { useMemo } from 'react';
import { getKeysInRange } from './pianoKeys.js';
import { getJoName } from '../notation/joNames';
import './PianoVisual.css';

const BLACK_WIDTH_RATIO = 0.6;
const NATURAL_PITCH_BY_MIDI_MOD = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
/** Mustad klahvid: MIDI mod 12 -> kas kõrgendus (#) või madaldus (b). Vaikimisi #. */
const BLACK_KEY_ACCIDENTAL = { 1: 'sharp', 3: 'sharp', 6: 'sharp', 8: 'sharp', 10: 'sharp' };

export function PianoVisual({
  firstNote = 48,
  lastNote = 72,
  activeNotes = [],
  onPlayNote,
  onStopNote,
  className = '',
  width = 600,
  height = 160,
  /** Figuurnotatsioon: { C: '#FF0000', D: '#8B4513', ... } – valged klahvid, --piano-figurenotes-color */
  figurenotesColors = null,
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
  const useFigurenotes = figurenotesColors && Object.keys(figurenotesColors).length > 0;

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
    const color = natural ? figurenotesColors[natural] : null;
    if (!color) return base;
    const textColor = natural === 'A' || natural === 'E' ? '#000000' : '#ffffff';
    return {
      ...base,
      ['--piano-figurenotes-color']: color,
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

  const getBlackKeyFigure = (midi) => {
    if (!useFigurenotes) return null;
    const mod = midi % 12;
    const naturalForColor = { 1: 'C', 3: 'D', 6: 'F', 8: 'G', 10: 'A' }[mod];
    const color = naturalForColor ? figurenotesColors[naturalForColor] : null;
    const arrow = BLACK_KEY_ACCIDENTAL[mod] || 'sharp';
    return color ? { color, arrow } : null;
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
              {useFigurenotes && getJoLabel(midi) && (
                <span className="PianoVisual__key-label" style={{ color: 'var(--piano-figurenotes-text)' }}>
                  {getJoLabel(midi)}
                </span>
              )}
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
