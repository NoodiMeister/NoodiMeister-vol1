/**
 * Transponeerimise loogika: noodid pooltoonide võrra, helistik.
 */
import { KEY_TO_SEMITONE } from '../utils/notationConstants';

const PITCH_TO_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PITCH_NAME_TO_NATURAL = {
  C: 'C', 'C#': 'C', Db: 'C', D: 'D', 'D#': 'D', Eb: 'D', E: 'E', F: 'F', 'F#': 'F', Gb: 'F',
  G: 'G', 'G#': 'G', Ab: 'G', A: 'A', 'A#': 'A', Bb: 'A', B: 'B',
};
const MIDI_PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export { KEY_TO_SEMITONE };

export function pitchOctaveToMidi(pitch, octave) {
  const semi = PITCH_TO_SEMI[pitch] ?? 0;
  const oct = Number(octave);
  if (!Number.isFinite(oct)) return 60;
  return (oct + 1) * 12 + semi;
}

export function getMidiAttributes(midiNumber) {
  const n = Number(midiNumber);
  if (!Number.isFinite(n) || n < 0 || n > 127) return { pitchName: 'C', octave: 4, isAccidental: false };
  const octave = Math.floor(n / 12) - 1;
  const pitchName = MIDI_PITCH_NAMES[n % 12];
  const isAccidental = [1, 3, 6, 8, 10].includes(n % 12);
  return { pitchName, octave, isAccidental };
}

export function midiToNoteWithAccidental(midiNumber) {
  const attrs = getMidiAttributes(midiNumber);
  const naturalPitch = PITCH_NAME_TO_NATURAL[attrs.pitchName] || attrs.pitchName.charAt(0);
  const accidental = attrs.pitchName?.includes('#') ? 1 : attrs.pitchName?.includes('b') ? -1 : 0;
  return { pitch: naturalPitch, octave: attrs.octave, accidental };
}

/**
 * Transponeerib noodid etteantud pooltoonide võrra. Pausid jäävad muutmata.
 */
export function transposeNotes(notes, semitones) {
  if (!semitones) return notes;
  return notes.map((note) => {
    if (note.isRest) return { ...note };
    const acc = note.accidental ?? 0;
    const midi = pitchOctaveToMidi(note.pitch, note.octave) + acc;
    const newMidi = Math.max(0, Math.min(127, midi + semitones));
    const { pitch, octave, accidental } = midiToNoteWithAccidental(newMidi);
    return { ...note, pitch, octave, accidental };
  });
}

/**
 * Arvuta pooltoonide arv helistikust fromKey → toKey.
 */
export function getTransposeSemitones(fromKey, toKey) {
  const fromSemi = KEY_TO_SEMITONE[fromKey] ?? 0;
  const toSemi = KEY_TO_SEMITONE[toKey] ?? 0;
  return toSemi - fromSemi;
}
