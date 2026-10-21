/**
 * Transponeerimise loogika: noodid pooltoonide võrra, helistik.
 */
import { getAccidentalForPitchInKey, getSemitonesFromKey, KEY_TO_SEMITONE } from '../utils/notationConstants.js';
import { getPitchFromMidi } from './PitchInputLogic.js';

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
 * Efektiivne alteratsioon: eksplitsiitne accidental, muidu helistiku diatooniline märk.
 * Nt D-duuris `{ pitch: 'F' }` ilma accidentalita = F# (1), mitte F♮.
 */
export function getEffectiveAccidental(note, keySignature = 'C') {
  if (!note || note.isRest) return 0;
  if (note.accidental !== undefined && note.accidental !== null) {
    const n = Number(note.accidental);
    return Number.isFinite(n) ? n : 0;
  }
  return getAccidentalForPitchInKey(note.pitch, keySignature);
}

/**
 * Eemaldab liigsed eksplitsiitsed alteratsioonid, mis kattuvad helistikuga.
 * Säilitab bekaarid/dieesid, mis tühistavad võtmemärki (nt F♮ D-duuris).
 */
export function normalizeAccidentalsForKey(noteList, targetKey) {
  if (!Array.isArray(noteList) || noteList.length === 0) return noteList;
  return noteList.map((note) => {
    if (!note || note.isRest) return note;
    const keyAcc = getAccidentalForPitchInKey(note.pitch, targetKey);
    const effectiveAcc = getEffectiveAccidental(note, targetKey);
    if (effectiveAcc === keyAcc) {
      if (note.accidental === undefined || note.accidental === null) return note;
      const { accidental: _drop, ...rest } = note;
      return rest;
    }
    return { ...note, accidental: effectiveAcc };
  });
}

function applySpellingToNote(note, spelled) {
  const next = { ...note, pitch: spelled.pitch, octave: spelled.octave };
  if (spelled.accidental === undefined || spelled.accidental === null) {
    if (next.accidental !== undefined) {
      const { accidental: _drop, ...rest } = next;
      return rest;
    }
    return next;
  }
  return { ...next, accidental: spelled.accidental };
}

/**
 * Transponeerib noodid etteantud pooltoonide võrra. Pausid jäävad muutmata.
 * @param {object[]} notes
 * @param {number} semitones
 * @param {string|{ fromKey?: string, toKey?: string }} [fromKeyOrOpts] - lähtehelistik (diatooniliste #/♭ jaoks) või opts
 * @param {string} [maybeToKey] - sihthelistik (key-aware spelling); kui puudub, sharp-põhine fallback
 */
export function transposeNotes(notes, semitones, fromKeyOrOpts, maybeToKey) {
  if (!semitones) return notes;
  let fromKey = 'C';
  let toKey = null;
  if (fromKeyOrOpts && typeof fromKeyOrOpts === 'object') {
    fromKey = fromKeyOrOpts.fromKey ?? 'C';
    toKey = fromKeyOrOpts.toKey ?? null;
  } else if (typeof fromKeyOrOpts === 'string') {
    fromKey = fromKeyOrOpts;
    toKey = typeof maybeToKey === 'string' ? maybeToKey : null;
  }

  return notes.map((note) => {
    if (!note || note.isRest) return note ? { ...note } : note;
    const acc = getEffectiveAccidental(note, fromKey);
    const midi = pitchOctaveToMidi(note.pitch, note.octave) + acc;
    const newMidi = Math.max(0, Math.min(127, midi + semitones));
    if (toKey) {
      return applySpellingToNote(note, getPitchFromMidi(newMidi, toKey));
    }
    const { pitch, octave, accidental } = midiToNoteWithAccidental(newMidi);
    return { ...note, pitch, octave, accidental };
  });
}

/**
 * Arvuta pooltoonide arv helistikust fromKey → toKey.
 * Uses rule-based getSemitonesFromKey so any key name (e.g. F#, Ab) works without listing.
 */
export function getTransposeSemitones(fromKey, toKey) {
  const fromSemi = KEY_TO_SEMITONE[fromKey] ?? getSemitonesFromKey(fromKey);
  const toSemi = KEY_TO_SEMITONE[toKey] ?? getSemitonesFromKey(toKey);
  return toSemi - fromSemi;
}
