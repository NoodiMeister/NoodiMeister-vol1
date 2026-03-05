/**
 * InteractivePiano – dünaamiline klaveriklaviatuur (vähemalt 2 oktaavi).
 * Iga klahv on interaktiivne (klikitav), saadab sündmuse onNotePlay.
 * Heli: AudioContext Oscillator. MIDI: reageerib välisele MIDI-klaviatuurile.
 */

import React, { useCallback } from 'react';
import { usePianoEngine } from './PianoEngine.js';
import './InteractivePiano.css';
import { PianoVisual } from './PianoVisual.jsx';
import { useKeyboardHandler } from './useKeyboardHandler.js';
import { useMidiHandler } from './useMidiHandler.js';
import { DEFAULT_FIRST_NOTE, DEFAULT_LAST_NOTE } from './keyboardMap.js';

export function InteractivePiano({
  firstNote = DEFAULT_FIRST_NOTE,
  lastNote = DEFAULT_LAST_NOTE,
  width = 600,
  height = 160,
  className = '',
  showMidiSelect = true,
  engineOptions = {},
  onNotePlay,
  onNoteStop,
  /** Figuurnotatsioon: klahvide värvid { C: '#FF0000', D: '#8B4513', ... } */
  figurenotesColors = null,
  /** Helistik JO/LE ja mustade klahvide noole jaoks (nt 'C') */
  keySignature = 'C',
}) {
  const { activeNotes, playNote, stopNote } = usePianoEngine(engineOptions);

  const handlePlayNote = useCallback(
    (midi) => {
      playNote(midi);
      onNotePlay?.(midi);
    },
    [playNote, onNotePlay]
  );

  const handleStopNote = useCallback(
    (midi) => {
      stopNote(midi);
      onNoteStop?.(midi);
    },
    [stopNote, onNoteStop]
  );

  useKeyboardHandler(firstNote, lastNote, handlePlayNote, handleStopNote, true);
  const midi = useMidiHandler(handlePlayNote, handleStopNote, true);

  return (
    <div className={`InteractivePiano ${className}`.trim()}>
      {showMidiSelect && midi.supported && (
        <div className="InteractivePiano__midi">
          {midi.error && <span className="InteractivePiano__midi-error">{midi.error}</span>}
          {midi.inputs.length > 0 && (
            <label className="InteractivePiano__midi-label">
              MIDI:{' '}
              <select
                value={midi.selectedId ?? ''}
                onChange={(e) => midi.setSelectedId(e.target.value || null)}
                className="InteractivePiano__midi-select"
              >
                <option value="">—</option>
                {midi.inputs.map((input) => (
                  <option key={input.id} value={input.id}>
                    {input.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      <PianoVisual
        firstNote={firstNote}
        lastNote={lastNote}
        activeNotes={activeNotes}
        onPlayNote={handlePlayNote}
        onStopNote={handleStopNote}
        width={width}
        height={height}
        figurenotesColors={figurenotesColors}
        keySignature={keySignature}
      />
    </div>
  );
}
