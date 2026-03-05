/**
 * InteractivePiano – ühendab PianoEngine, PianoVisual ja sisendihaldurid.
 * Hiir, arvutiklaviatuur ja MIDI kutsub ühiseid playNote/stopNote.
 */

import React from 'react';
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
}) {
  const { activeNotes, playNote, stopNote } = usePianoEngine(engineOptions);

  useKeyboardHandler(firstNote, lastNote, playNote, stopNote, true);
  const midi = useMidiHandler(playNote, stopNote, true);

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
        onPlayNote={playNote}
        onStopNote={stopNote}
        width={width}
        height={height}
      />
    </div>
  );
}
