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

/** Helistik → pooltoonide nihe C-st (transponeerimiseks). */
export const KEY_TO_SEMITONE = {
  C: 0, G: 7, D: 2, A: 4, E: 6, B: 8, F: 5, Bb: 10, Eb: 3,
};
