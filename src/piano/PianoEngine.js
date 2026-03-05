/**
 * PianoEngine – loogikakiht.
 * Haldab activeNotes seisundit ja heli (Web Audio API OscillatorNode).
 * Kõik sisendid (hiir, klaviatuur, MIDI) kasutavad playNote(pitch) ja stopNote(pitch).
 * pitch = MIDI noodinumber (0–127), nt C4 = 60.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/** MIDI noodinumbrist sagedus (Hz). A4 = 440 Hz, MIDI 69. */
export function midiToFrequency(midiNumber) {
  return 440 * Math.pow(2, (midiNumber - 69) / 12);
}

/**
 * Loob ja tagastab piano mootori: activeNotes, playNote, stopNote.
 * @param {Object} [options]
 * @param {string} [options.type='sine'] – OscillatorNode type (sine, square, triangle, sawtooth)
 */
export function usePianoEngine(options = {}) {
  const { type = 'sine' } = options;
  const [activeNotes, setActiveNotes] = useState([]);
  const audioContextRef = useRef(null);
  const oscillatorsRef = useRef(new Map());

  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = ctx;
    return ctx;
  }, []);

  const stopOscillator = useCallback((pitch) => {
    const entry = oscillatorsRef.current.get(pitch);
    if (entry) {
      try {
        entry.oscillator.stop();
      } catch (_) {}
      entry.gainNode.disconnect();
      oscillatorsRef.current.delete(pitch);
    }
  }, []);

  const playNote = useCallback(
    (pitch) => {
      const midi = Number(pitch);
      if (!Number.isFinite(midi) || midi < 0 || midi > 127) return;
      setActiveNotes((prev) => (prev.includes(midi) ? prev : [...prev, midi]));
      stopOscillator(midi);
      const ctx = ensureAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(midiToFrequency(midi), ctx.currentTime);
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(ctx.currentTime);
      oscillatorsRef.current.set(midi, { oscillator, gainNode });
    },
    [ensureAudioContext, stopOscillator, type]
  );

  const stopNote = useCallback(
    (pitch) => {
      const midi = Number(pitch);
      if (!Number.isFinite(midi)) return;
      setActiveNotes((prev) => prev.filter((n) => n !== midi));
      stopOscillator(midi);
    },
    [stopOscillator]
  );

  useEffect(() => {
    return () => {
      oscillatorsRef.current.forEach((_, pitch) => stopOscillator(pitch));
    };
  }, [stopOscillator]);

  return { activeNotes, playNote, stopNote };
}
