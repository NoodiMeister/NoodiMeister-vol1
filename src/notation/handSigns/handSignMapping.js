/**
 * JO-LE-MI ↔ uTheory Solfege font key map (teacher = uppercase).
 * Font files stay unmodified (CC BY-NC-ND); RTL mirror is render-time only.
 * @see docs/utheory-solfege/JO-LE-MI-MAPPING.md
 */

import { JO_NAMES, getJoDegreeIndex } from '../joNames';

/** Degree name → uTheory font character (teacher / third-person). */
export const JO_DEGREE_TO_TEACHER_CHAR = {
  JO: 'D',
  LE: 'R',
  MI: 'M',
  NA: 'F',
  SO: 'S',
  RA: 'L',
  DI: 'T',
};

/** Degree name → uTheory font character (self / first-person). */
export const JO_DEGREE_TO_SELF_CHAR = {
  JO: 'd',
  LE: 'r',
  MI: 'm',
  NA: 'f',
  SO: 's',
  RA: 'l',
  DI: 't',
};

export const UTHEORY_SOLFEGE_FONT_FAMILY = 'uTheory Solfege';

/** Equal spacing for C-mode 7 degree lines (px between consecutive lines). */
export const HAND_SIGN_DEGREE_LINE_SPACING_PX = 28;

/** Hand glyph optical size on the degree staff. */
export const HAND_SIGN_GLYPH_FONT_SIZE_PX = 40;

export function getHandSignCharForDegreeName(degreeName, { perspective = 'teacher' } = {}) {
  const key = String(degreeName || 'JO').toUpperCase();
  const table = perspective === 'self' ? JO_DEGREE_TO_SELF_CHAR : JO_DEGREE_TO_TEACHER_CHAR;
  return table[key] || table.JO;
}

export function getHandSignCharForNote(pitch, octave, keySignature, joStaffPosition, options) {
  const degreeIndex = getJoDegreeIndex(pitch, octave, keySignature, joStaffPosition);
  const degreeName = JO_NAMES[degreeIndex] ?? 'JO';
  return {
    degreeIndex,
    degreeName,
    char: getHandSignCharForDegreeName(degreeName, options),
  };
}

/**
 * Y of degree line index 0…6 within a staff whose top line (DI) is at topLineY.
 * Line 0 = JO (bottom), line 6 = DI (top).
 */
export function getDegreeLineY(degreeIndex, topLineY, lineSpacing = HAND_SIGN_DEGREE_LINE_SPACING_PX) {
  const clamped = Math.max(0, Math.min(6, Math.round(Number(degreeIndex) || 0)));
  return topLineY + (6 - clamped) * lineSpacing;
}

export function getHandSignStaffGeometry({
  lineSpacing = HAND_SIGN_DEGREE_LINE_SPACING_PX,
  topPad = 16,
  bottomPad = 28,
  lyricReserve = 24,
} = {}) {
  const staffSpan = 6 * lineSpacing;
  const topLineY = topPad;
  const bottomLineY = topLineY + staffSpan;
  const height = bottomLineY + bottomPad + lyricReserve;
  return {
    lineSpacing,
    topPad,
    bottomPad,
    lyricReserve,
    topLineY,
    bottomLineY,
    staffSpan,
    height,
    degreeCount: 7,
  };
}
