/**
 * MIDI sisendihaldur (Web MIDI API).
 * Kuulab noteOn ja noteOff sõnumeid ja kutsub playNote/stopNote.
 */

import { useEffect, useState, useCallback } from 'react';

/**
 * @param {(pitch: number) => void} playNote – pitch = MIDI note number (0–127)
 * @param {(pitch: number) => void} stopNote
 * @param {boolean} [enabled=true]
 * @returns {{ supported: boolean, error: string | null, inputs: MIDIInput[], selectedId: string | null, setSelectedId: (id: string | null) => void }}
 */
export function useMidiHandler(playNote, stopNote, enabled = true) {
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState(null);
  const [inputs, setInputs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const inputRef = useCallback((input) => {
    if (!input) return;
    const onMidi = (e) => {
      const [cmd, note, velocity] = e.data;
      const pitch = note;
      if (cmd === 144) {
        if (velocity > 0) playNote(pitch);
        else stopNote(pitch);
      } else if (cmd === 128) {
        stopNote(pitch);
      }
    };
    input.addEventListener('midimessage', onMidi);
    return () => input.removeEventListener('midimessage', onMidi);
  }, [playNote, stopNote]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setSupported(false);
      setError('Web MIDI API ei ole toetatud');
      return;
    }
    setSupported(true);
    setError(null);

    let midiAccess = null;
    const updateInputs = () => {
      if (!midiAccess) return;
      const list = Array.from(midiAccess.inputs.values());
      setInputs(list);
      if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    };

    navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        midiAccess = access;
        updateInputs();
        access.addEventListener('statechange', updateInputs);
      })
      .catch((err) => {
        setError(err?.message || 'MIDI ligipääs ebaõnnestus');
      });

    return () => {
      if (midiAccess) midiAccess.removeEventListener('statechange', updateInputs);
    };
  }, []);

  const selectedInput = selectedId ? inputs.find((i) => i.id === selectedId) : null;

  useEffect(() => {
    if (!enabled || !selectedInput) return;
    const cleanup = inputRef(selectedInput);
    return () => (typeof cleanup === 'function' ? cleanup() : undefined);
  }, [enabled, selectedId, selectedInput, inputRef]);

  return { supported, error, inputs, selectedId, setSelectedId };
}
