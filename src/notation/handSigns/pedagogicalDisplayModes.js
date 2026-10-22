/**
 * Pedagoogilise notatsiooni kuvarežiimid A/B/C/D (sama loo vaated).
 * Ei muuda sourceNotationMode'i — ainult pedagoogilise faili sisene display.
 *
 * A/B/C = noodistus / kuvamine (sisestus ja korrastus).
 * D = interaktiivne / playback (heli, cue'd, playhead, meedia-toolbar) — eraldi, et
 *     playback ei segaks nootide loomist ega redigeerimist.
 */

export const PEDAGOGICAL_DISPLAY_A = 'joStaff';
export const PEDAGOGICAL_DISPLAY_B = 'joStaffHandSigns';
export const PEDAGOGICAL_DISPLAY_C = 'handSignLyrics';
/** Interaktiivne / playback režiim (heli, cue, animatsioon). */
export const PEDAGOGICAL_DISPLAY_D = 'interactive';

export const PEDAGOGICAL_DISPLAY_MODES = [
  PEDAGOGICAL_DISPLAY_A,
  PEDAGOGICAL_DISPLAY_B,
  PEDAGOGICAL_DISPLAY_C,
  PEDAGOGICAL_DISPLAY_D,
];

export const DEFAULT_PEDAGOGICAL_DISPLAY_MODE = PEDAGOGICAL_DISPLAY_A;

export function normalizePedagogicalDisplayMode(value) {
  if (value === 'A' || value === PEDAGOGICAL_DISPLAY_A) return PEDAGOGICAL_DISPLAY_A;
  if (value === 'B' || value === PEDAGOGICAL_DISPLAY_B) return PEDAGOGICAL_DISPLAY_B;
  if (value === 'C' || value === PEDAGOGICAL_DISPLAY_C) return PEDAGOGICAL_DISPLAY_C;
  if (value === 'D' || value === PEDAGOGICAL_DISPLAY_D || value === 'interactivePlayback') {
    return PEDAGOGICAL_DISPLAY_D;
  }
  return DEFAULT_PEDAGOGICAL_DISPLAY_MODE;
}

export function isHandSignLyricsDisplayMode(mode) {
  return normalizePedagogicalDisplayMode(mode) === PEDAGOGICAL_DISPLAY_C;
}

export function isJoStaffHandSignsDisplayMode(mode) {
  return normalizePedagogicalDisplayMode(mode) === PEDAGOGICAL_DISPLAY_B;
}

export function isPedagogicalInteractiveDisplayMode(mode) {
  return normalizePedagogicalDisplayMode(mode) === PEDAGOGICAL_DISPLAY_D;
}

/**
 * Score render mapping: D (interactive overlays) uses A staff geometry.
 * B keeps its id (A staff + hand signs under notes). C = 7-line hand-sign layout.
 */
export function resolvePedagogicalRenderMode(mode) {
  const normalized = normalizePedagogicalDisplayMode(mode);
  if (normalized === PEDAGOGICAL_DISPLAY_D) {
    return PEDAGOGICAL_DISPLAY_A;
  }
  return normalized;
}
