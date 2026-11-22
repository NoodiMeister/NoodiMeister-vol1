/**
 * Pedagoogilise notatsiooni kuvarežiimid A/B/C (sama loo vaated).
 * Ei muuda sourceNotationMode'i — ainult pedagoogilise faili sisene display.
 *
 * A/B/C = noodistus / kuvamine (sisestus ja korrastus).
 * Endine D (interactive) elab eraldi programmis: Muusika stuudio → Montaaž (`/stuudio`).
 */

export const PEDAGOGICAL_DISPLAY_A = 'joStaff';
export const PEDAGOGICAL_DISPLAY_B = 'joStaffHandSigns';
export const PEDAGOGICAL_DISPLAY_C = 'handSignLyrics';
/** @deprecated Legacy only — maps to A. Interactive lives in /stuudio (Montaaž). */
export const PEDAGOGICAL_DISPLAY_D = 'interactive';

export const PEDAGOGICAL_DISPLAY_MODES = [
  PEDAGOGICAL_DISPLAY_A,
  PEDAGOGICAL_DISPLAY_B,
  PEDAGOGICAL_DISPLAY_C,
];

export const DEFAULT_PEDAGOGICAL_DISPLAY_MODE = PEDAGOGICAL_DISPLAY_A;

export function normalizePedagogicalDisplayMode(value) {
  if (value === 'A' || value === PEDAGOGICAL_DISPLAY_A) return PEDAGOGICAL_DISPLAY_A;
  if (value === 'B' || value === PEDAGOGICAL_DISPLAY_B) return PEDAGOGICAL_DISPLAY_B;
  if (value === 'C' || value === PEDAGOGICAL_DISPLAY_C) return PEDAGOGICAL_DISPLAY_C;
  // Legacy D / interactive files open as A (editing). Playback is Montaaž.
  if (value === 'D' || value === PEDAGOGICAL_DISPLAY_D || value === 'interactivePlayback') {
    return PEDAGOGICAL_DISPLAY_A;
  }
  return DEFAULT_PEDAGOGICAL_DISPLAY_MODE;
}

export function isHandSignLyricsDisplayMode(mode) {
  return normalizePedagogicalDisplayMode(mode) === PEDAGOGICAL_DISPLAY_C;
}

export function isJoStaffHandSignsDisplayMode(mode) {
  return normalizePedagogicalDisplayMode(mode) === PEDAGOGICAL_DISPLAY_B;
}

/** Always false in notation editor — interactive UI moved to Montaaž. */
export function isPedagogicalInteractiveDisplayMode(_mode) {
  return false;
}

/**
 * Score render mapping: A/B share JO staff geometry; C = 7-line hand-sign layout.
 */
export function resolvePedagogicalRenderMode(mode) {
  return normalizePedagogicalDisplayMode(mode);
}
