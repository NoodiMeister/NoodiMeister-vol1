/**
 * SVG-põhine klaveri klaviatuur (52 valget klahvi, täispikk 88-klahvine klaver).
 * Jälgib akna laiust ja joonistab valged ning mustad klahvid SVG-s.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { getKeysInRange } from '../piano/pianoKeys';

const PIANO_MIDI_MIN = 21;  // A0
const PIANO_MIDI_MAX = 108; // C8
const BLACK_WIDTH_RATIO = 0.6;   // musta klahvi laius valge suhtes
const BLACK_HEIGHT_RATIO = 0.62; // musta klahvi kõrgus (protsent piano kõrgusest)

export function PianoKeyboardSVG({
  onNotePlay,
  onNoteStop,
  activeNotes = [],
  className = '',
}) {
  const [containerWidth, setContainerWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 800
  );

  useEffect(() => {
    const handleResize = () => setContainerWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { white, black } = useMemo(
    () => getKeysInRange(PIANO_MIDI_MIN, PIANO_MIDI_MAX),
    []
  );

  const whiteKeyCount = white.length;
  const padding = 40;
  const contentWidth = Math.max(1, containerWidth - padding);
  const whiteKeyWidth = contentWidth / whiteKeyCount;
  const pianoHeight = Math.max(150, whiteKeyWidth * 5);
  const blackKeyWidth = whiteKeyWidth * BLACK_WIDTH_RATIO;
  const blackKeyHeight = pianoHeight * BLACK_HEIGHT_RATIO;
  const activeSet = useMemo(() => new Set(activeNotes), [activeNotes]);

  const handlePointerDown = (e, midi) => {
    e.preventDefault();
    onNotePlay?.(midi);
  };

  const handlePointerUp = (e, midi) => {
    e.preventDefault();
    onNoteStop?.(midi);
  };

  const handlePointerLeave = (e, midi) => {
    if (e.buttons !== 0) onNoteStop?.(midi);
  };

  return (
    <div
      className={`piano-wrapper ${className}`.trim()}
      style={{ width: '100%', overflow: 'hidden', padding: '10px' }}
      role="application"
      aria-label="Klaver"
    >
      <svg
        width="100%"
        height={pianoHeight}
        viewBox={`0 0 ${contentWidth} ${pianoHeight}`}
        preserveAspectRatio="none"
      >
        {/* Valged klahvid */}
        <g aria-hidden="true">
          {white.map(({ midi, index }) => {
            const x = index * whiteKeyWidth;
            const isActive = activeSet.has(midi);
            return (
              <rect
                key={midi}
                x={x}
                y={0}
                width={whiteKeyWidth}
                height={pianoHeight}
                fill={isActive ? '#fcd34d' : '#fefce8'}
                stroke="#ca8a04"
                strokeWidth={1}
                rx={0}
                ry={6}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => handlePointerDown(e, midi)}
                onPointerUp={(e) => handlePointerUp(e, midi)}
                onPointerLeave={(e) => handlePointerLeave(e, midi)}
                onContextMenu={(e) => e.preventDefault()}
              />
            );
          })}
        </g>

        {/* Mustad klahvid (peal) */}
        <g aria-hidden="true">
          {black.map(({ midi, whiteIndex }) => {
            const x = whiteIndex * whiteKeyWidth + whiteKeyWidth - blackKeyWidth / 2;
            const isActive = activeSet.has(midi);
            return (
              <rect
                key={midi}
                x={x}
                y={0}
                width={blackKeyWidth}
                height={blackKeyHeight}
                fill={isActive ? '#475569' : '#1e293b'}
                stroke="#334155"
                strokeWidth={1}
                rx={0}
                ry={4}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => handlePointerDown(e, midi)}
                onPointerUp={(e) => handlePointerUp(e, midi)}
                onPointerLeave={(e) => handlePointerLeave(e, midi)}
                onContextMenu={(e) => e.preventDefault()}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
