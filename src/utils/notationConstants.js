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
