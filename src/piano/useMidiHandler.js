/**
 * MIDI sisendihaldur (Web MIDI API).
 * Kuulab noteOn ja noteOff sõnumeid ja kutsub playNote/stopNote.
 * Callback’id hoitakse ref’is, et listenerit ei eemaldataks/lisataks igal renderil
 * (vältib topelt-noteOn lekkeid kui parent annab uue funktsiooni).
 */

import { useEffect, useState, useRef } from 'react';

function midiStatus(cmd) {
  return Number(cmd) & 0xf0;
}

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
  const playNoteRef = useRef(playNote);
  const stopNoteRef = useRef(stopNote);
  playNoteRef.current = playNote;
  stopNoteRef.current = stopNote;

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
      setSelectedId((prev) => {
        if (prev && list.some((i) => i.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
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
    const onMidi = (e) => {
      const data = e?.data;
      if (!data || data.length < 2) return;
      const status = midiStatus(data[0]);
      const pitch = data[1];
      const velocity = data.length > 2 ? data[2] : 0;
      if (status === 0x90) {
        if (velocity > 0) playNoteRef.current?.(pitch);
        else stopNoteRef.current?.(pitch);
      } else if (status === 0x80) {
        stopNoteRef.current?.(pitch);
      }
    };
    selectedInput.addEventListener('midimessage', onMidi);
    return () => selectedInput.removeEventListener('midimessage', onMidi);
  }, [enabled, selectedInput]);

  return { supported, error, inputs, selectedId, setSelectedId };
}
