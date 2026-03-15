/**
 * Globaalsed notatsiooni konstandid – laetakse enne komponente (vältib TDZ/ReferenceError Vercelil).
 * JO-võti, noodiväärtused ja vaikimisi kuvatavad seaded.
 */

/** JO (toonika) vaikimisi staff-positsioon: -2 = C, 2 = G, 4 = D jne (viiulivõtme skaala). */
export const DEFAULT_JO_CLEF_STAFF_POSITION = -2;

/** JO-võtme lubatud vahemik (üles/alla nooltega). */
export const JO_CLEF_POSITION_MIN = -2;
export const JO_CLEF_POSITION_MAX = 10;

/** Vaikimisi: näita õpetaja märgistusi (JO-nimed, emojid) noodipeal. */
export const DEFAULT_SHOW_EMOJI_OVERLAYS = true;

/** Vaikimisi: ära näita rütmisilbe (Kodály TA, TI-TI jne). */
export const DEFAULT_SHOW_RHYTHM_SYLLABLES = false;

/** Vaikimisi: ära näita kõikidel nootidel JO-nimesid. */
export const DEFAULT_SHOW_ALL_NOTE_LABELS = false;

/** Letter name → semitone above C (0–11). Rule: no need to list every key. */
const PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Order of pitch letters for diatonic scale steps. */
export const PITCH_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * Semitone 0–11 for a note (letter + accidental).
 * @param {string} letter - C, D, E, F, G, A, B
 * @param {number} [accidental=0] - -1 = flat, 0 = natural, 1 = sharp
 */
export function getPitchSemitone(letter, accidental = 0) {
  const base = PITCH_CLASS[letter?.toUpperCase?.()];
  if (base === undefined) return 0;
  return ((base + (accidental ?? 0)) % 12 + 12) % 12;
}

/** Major scale intervals (semitones) from root: 1st, 2nd, ... 7th. */
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

/**
 * Diatonic scale (major) for the given key. Each degree has letter, accidental, and semitone.
 * E.g. D major → [{ letter: 'D', accidental: 0 }, { letter: 'E', accidental: 0 }, { letter: 'F', accidental: 1 }, ...]
 * @param {string} keyName - e.g. 'C', 'G', 'D', 'F', 'Bb', 'F#'
 * @returns {{ letter: string, accidental: number, semitone: number }[]}
 */
export function getDiatonicScaleForKey(keyName) {
  if (!keyName || typeof keyName !== 'string') keyName = 'C';
  const rootSemitone = getSemitonesFromKey(keyName);
  const keyLetter = keyName.trim().slice(0, 1).toUpperCase();
  const keyLetterIndex = PITCH_ORDER.indexOf(keyLetter);
  if (keyLetterIndex < 0) return PITCH_ORDER.map((letter, i) => ({
    letter,
    accidental: 0,
    semitone: (PITCH_CLASS[letter] + 12) % 12
  }));

  const scale = [];
  for (let i = 0; i < 7; i++) {
    const letter = PITCH_ORDER[(keyLetterIndex + i) % 7];
    const targetSemitone = (rootSemitone + MAJOR_SCALE_INTERVALS[i]) % 12;
    const letterBase = PITCH_CLASS[letter];
    let diff = (targetSemitone - letterBase + 12) % 12;
    const accidental = diff === 0 ? 0 : diff === 1 ? 1 : diff === 11 ? -1 : 0;
    scale.push({ letter, accidental, semitone: targetSemitone });
  }
  return scale;
}

/**
 * Helistiku järgi nooditähe alteratsioon (0, 1 või -1). Kasutada noodi lisamisel, kui kasutaja ei näe võtmemärke (nt figuurnotatsioon).
 * @param {string} pitch - C, D, E, F, G, A, B
 * @param {string} keySignature - nt 'C', 'G', 'D', 'F', 'Bb'
 * @returns {number} 0 = looduslik, 1 = diees, -1 = bemoll
 */
export function getAccidentalForPitchInKey(pitch, keySignature) {
  if (!pitch || typeof pitch !== 'string') return 0;
  const letter = pitch.trim().slice(0, 1).toUpperCase();
  const scale = getDiatonicScaleForKey(keySignature);
  const degree = scale.find((d) => d.letter === letter);
  return degree ? degree.accidental : 0;
}

/**
 * Semitones from C for any key name (rule-based).
 * Key = letter + optional accidental: "C", "G", "Bb", "F#", "Ab", "C#", etc.
 */
export function getSemitonesFromKey(keyName) {
  if (!keyName || typeof keyName !== 'string') return 0;
  const s = keyName.trim();
  const letter = s.slice(0, 1).toUpperCase();
  const rest = s.slice(1).replace(/\s/g, '');
  let accidental = 0;
  if (rest.includes('#') || rest.toLowerCase().includes('sharp')) accidental += 1;
  if (rest.includes('b') || rest.toLowerCase().includes('flat')) accidental -= 1;
  const base = PITCH_CLASS[letter];
  if (base === undefined) return 0;
  return ((base + accidental) % 12 + 12) % 12;
}

/** Helistik → pooltoonide nihe C-st (transponeerimiseks). Kept for backward compat; new code can use getSemitonesFromKey(key). */
export const KEY_TO_SEMITONE = {
  C: 0, G: 7, D: 2, A: 4, E: 6, B: 8, F: 5, Bb: 10, Eb: 3,
};
