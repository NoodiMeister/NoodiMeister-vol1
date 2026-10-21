/**
 * Pedagoogilise notatsiooni kuvarežiimid A/B/C (sama loo vaated).
 * Ei muuda sourceNotationMode'i — ainult pedagoogilise faili sisene display.
 */

export const PEDAGOGICAL_DISPLAY_A = 'joStaff';
export const PEDAGOGICAL_DISPLAY_B = 'joStaffHandSigns';
export const PEDAGOGICAL_DISPLAY_C = 'handSignLyrics';

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
  return DEFAULT_PEDAGOGICAL_DISPLAY_MODE;
}

export function isHandSignLyricsDisplayMode(mode) {
  return normalizePedagogicalDisplayMode(mode) === PEDAGOGICAL_DISPLAY_C;
}

/** B is specified but not fully implemented — render falls back to A until hands-under-notes lands. */
export function resolvePedagogicalRenderMode(mode) {
  const normalized = normalizePedagogicalDisplayMode(mode);
  if (normalized === PEDAGOGICAL_DISPLAY_B) return PEDAGOGICAL_DISPLAY_A;
  return normalized;
}
