/**
 * PianoVisual – visuaalne klaverikomponent.
 * Klahvid reageerivad activeNotes muudatustele, on klikitavad (hiir).
 * Mustad ja valged klahvid täpselt joondatud (mustad valgete peal).
 */

import React, { useMemo } from 'react';
import { getKeysInRange } from './pianoKeys.js';
import './PianoVisual.css';

const BLACK_WIDTH_RATIO = 0.6;

export function PianoVisual({
  firstNote = 48,
  lastNote = 72,
  activeNotes = [],
  onPlayNote,
  onStopNote,
  className = '',
  width = 600,
  height = 160,
}) {
  const { white, black } = useMemo(
    () => getKeysInRange(firstNote, lastNote),
    [firstNote, lastNote]
  );

  const whiteWidth = white.length > 0 ? 100 / white.length : 0;
  const blackWidthPct = whiteWidth * BLACK_WIDTH_RATIO;
  const activeSet = useMemo(() => new Set(activeNotes), [activeNotes]);

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

  return (
    <div
      className={`PianoVisual ${className}`.trim()}
      style={{ width, height }}
      role="application"
      aria-label="Klaver"
    >
      <div className="PianoVisual__keys">
        <div className="PianoVisual__white-row">
          {white.map(({ midi, index }) => (
            <button
              key={midi}
              type="button"
              className={`PianoVisual__key PianoVisual__key--white ${activeSet.has(midi) ? 'PianoVisual__key--active' : ''}`}
              style={{ width: `${whiteWidth}%` }}
              onPointerDown={(e) => handlePointerDown(e, midi)}
              onPointerUp={(e) => handlePointerUp(e, midi)}
              onPointerLeave={(e) => handlePointerLeave(e, midi)}
              onContextMenu={(e) => e.preventDefault()}
            />
          ))}
        </div>
        <div className="PianoVisual__black-row">
          {black.map(({ midi, whiteIndex }) => (
            <button
              key={midi}
              type="button"
              className={`PianoVisual__key PianoVisual__key--black ${activeSet.has(midi) ? 'PianoVisual__key--active' : ''}`}
              style={{
                width: `${blackWidthPct}%`,
                left: `${whiteIndex * whiteWidth + whiteWidth - blackWidthPct / 2}%`,
              }}
              onPointerDown={(e) => handlePointerDown(e, midi)}
              onPointerUp={(e) => handlePointerUp(e, midi)}
              onPointerLeave={(e) => handlePointerLeave(e, midi)}
              onContextMenu={(e) => e.preventDefault()}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
