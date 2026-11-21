import { getAccidentalForPitchInKey, getSemitonesFromKey } from '../utils/notationConstants.js';

/**
 * Kõrguse sisestuse loogika: klaviatuuri klahv (MIDI) → noodimeistri noot (pitch, octave, accidental).
 * Mootor kasutab seda, kui kasutaja vajutab PianoKeyboard peal klahvi.
 *
 * Enharmonic (MuseScore): helistiku suhtes eelistatakse
 * #1, ♭3, #4, #5, ♭7 (C-duuris: C#, Eb, F#, G#, Bb — mitte Db/D#/Gb/Ab/A#).
 */
const MIDI_PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PITCH_NAME_TO_NATURAL = { C: 'C', 'C#': 'C', Db: 'C', D: 'D', 'D#': 'D', Eb: 'D', E: 'E', F: 'F', 'F#': 'F', Gb: 'F', G: 'G', 'G#': 'G', Ab: 'G', A: 'A', 'A#': 'A', Bb: 'A', B: 'B' };
const PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PITCH_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
/** Implicit (võtmemärk) | natural | sharp | flat */
const ACCIDENTAL_CANDIDATES = [undefined, 0, 1, -1];

/** Suhteline PC toonikast → eelistatud alteratsioon (MuseScore MIDI heuristic). */
const CHROMATIC_PREF_FLAT_REL = new Set([3, 10]); // ♭3, ♭7
const CHROMATIC_PREF_SHARP_REL = new Set([1, 6, 8]); // #1, #4, #5

function getMidiAttributes(midiNumber) {
  const n = Number(midiNumber);
  if (!Number.isFinite(n) || n < 0 || n > 127) return { pitchName: 'C', octave: 4, isAccidental: false };
  const octave = Math.floor(n / 12) - 1;
  const pitchName = MIDI_PITCH_NAMES[n % 12];
  const isAccidental = [1, 3, 6, 8, 10].includes(n % 12);
  return { pitchName, octave, isAccidental };
}

/**
 * MIDI number → looduslik noot (C..B) ja oktaav.
 * @param {number} midiNumber - MIDI noodi number (0–127)
 * @returns {{ pitch: string, octave: number, isAccidental: boolean }}
 */
export function midiToPitchOctave(midiNumber) {
  const attrs = getMidiAttributes(midiNumber);
  const naturalPitch = PITCH_NAME_TO_NATURAL[attrs.pitchName] || attrs.pitchName.charAt(0);
  return { pitch: naturalPitch, octave: attrs.octave, isAccidental: attrs.isAccidental };
}

/**
 * Musta klahvi alteratsioon helistiku järgi (fallback).
 * @param {number} midiNumber
 * @param {string} keySignature - nt 'C', 'G', 'F', 'Bb'
 * @returns {number} -1, 0 või 1
 */
export function getAccidentalForPianoKey(midiNumber, keySignature) {
  const attrs = getMidiAttributes(midiNumber);
  if (!attrs.isAccidental) return 0;
  const tonicPc = getSemitonesFromKey(keySignature);
  const midiPc = ((Number(midiNumber) % 12) + 12) % 12;
  const rel = ((midiPc - tonicPc) % 12 + 12) % 12;
  if (CHROMATIC_PREF_FLAT_REL.has(rel)) return -1;
  if (CHROMATIC_PREF_SHARP_REL.has(rel)) return 1;
  const useFlat = keySignature === 'F' || keySignature === 'Bb' || keySignature === 'Eb'
    || keySignature === 'Ab' || keySignature === 'Db' || keySignature === 'Gb' || keySignature === 'Cb';
  return useFlat ? -1 : 1;
}

function toPitchClass(letter, accidental) {
  const base = PITCH_CLASS[letter];
  if (base == null) return 0;
  return ((base + accidental) % 12 + 12) % 12;
}

/**
 * @param {number} midiNumber
 * @param {string} keySignature
 * @returns {{ pitch: string, octave: number, accidental: number|undefined, score: number }|null}
 */
function resolveSpellingForMidiInKey(midiNumber, keySignature = 'C') {
  const n = Number(midiNumber);
  if (!Number.isFinite(n) || n < 0 || n > 127) return null;
  const midiPc = ((n % 12) + 12) % 12;
  const tonicPc = getSemitonesFromKey(keySignature);
  const relPc = ((midiPc - tonicPc) % 12 + 12) % 12;
  const preferFlat = CHROMATIC_PREF_FLAT_REL.has(relPc);
  const preferSharp = CHROMATIC_PREF_SHARP_REL.has(relPc);

  let best = null;
  for (const letter of PITCH_ORDER) {
    const keyAcc = getAccidentalForPitchInKey(letter, keySignature);
    for (const explicitAcc of ACCIDENTAL_CANDIDATES) {
      const effectiveAcc = explicitAcc === undefined ? keyAcc : explicitAcc;
      const pc = toPitchClass(letter, effectiveAcc);
      if (pc !== midiPc) continue;
      const octave = Math.floor((n - pc) / 12) - 1;
      if (!Number.isFinite(octave)) continue;
      const isImplicit = explicitAcc === undefined;
      const needsNatural = explicitAcc === 0 && keyAcc !== 0;
      // Implicit (võtmes) > natural cancel > explicit accidental
      let score = (isImplicit ? 0 : needsNatural ? 1 : 2) * 100;
      if (!isImplicit && !needsNatural) {
        if (preferFlat && explicitAcc === -1) score += 0;
        else if (preferSharp && explicitAcc === 1) score += 0;
        else if (preferFlat || preferSharp) score += 20;
        else score += 10;
      }
      // Stabiilne tie-break: eelistada diatoonilist tähte F/C ainult kui skoor võrdne muidu
      score += letter.charCodeAt(0) * 0.001;
      if (!best || score < best.score) {
        best = {
          pitch: letter,
          octave,
          accidental: isImplicit ? undefined : explicitAcc,
          score,
        };
      }
    }
  }
  return best;
}

/**
 * Ühene API mootorile: klahvi vajutus → õige kõrgus noodijoonestiku jaoks.
 * @param {number} midiNumber - klaviatuuri klahvi MIDI number
 * @param {string} keySignature - aktiivne helistik
 * @returns {{ pitch: string, octave: number, accidental: number|undefined }}
 */
export function getPitchFromMidi(midiNumber, keySignature = 'C') {
  const resolved = resolveSpellingForMidiInKey(midiNumber, keySignature);
  if (resolved) {
    return { pitch: resolved.pitch, octave: resolved.octave, accidental: resolved.accidental };
  }
  const { pitch, octave } = midiToPitchOctave(midiNumber);
  const accidental = getAccidentalForPianoKey(midiNumber, keySignature);
  return { pitch, octave, accidental };
}

export { resolveSpellingForMidiInKey };
