/**
 * Kõrguse sisestuse loogika: klaviatuuri klahv (MIDI) → noodimeistri noot (pitch, octave, accidental).
 * Mootor kasutab seda, kui kasutaja vajutab PianoKeyboard peal klahvi.
 */
const MIDI_PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PITCH_NAME_TO_NATURAL = { C: 'C', 'C#': 'C', Db: 'C', D: 'D', 'D#': 'D', Eb: 'D', E: 'E', F: 'F', 'F#': 'F', Gb: 'F', G: 'G', 'G#': 'G', Ab: 'G', A: 'A', 'A#': 'A', Bb: 'A', B: 'B' };

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
 * Musta klahvi alteratsioon helistiku järgi: bemolli-helistikud → -1 (♭), muud → 1 (♯). Valge klahv → 0.
 * @param {number} midiNumber
 * @param {string} keySignature - nt 'C', 'G', 'F', 'Bb'
 * @returns {number} -1, 0 või 1
 */
export function getAccidentalForPianoKey(midiNumber, keySignature) {
  const attrs = getMidiAttributes(midiNumber);
  if (!attrs.isAccidental) return 0;
  const useFlat = keySignature === 'F' || keySignature === 'Bb' || keySignature === 'Eb';
  return useFlat ? -1 : 1;
}

/**
 * Ühene API mootorile: klahvi vajutus → õige kõrgus noodijoonestiku jaoks.
 * @param {number} midiNumber - klaviatuuri klahvi MIDI number
 * @param {string} keySignature - aktiivne helistik
 * @returns {{ pitch: string, octave: number, accidental: number }}
 */
export function getPitchFromMidi(midiNumber, keySignature = 'C') {
  const { pitch, octave } = midiToPitchOctave(midiNumber);
  const accidental = getAccidentalForPianoKey(midiNumber, keySignature);
  return { pitch, octave, accidental };
}
