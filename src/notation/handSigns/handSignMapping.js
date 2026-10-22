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

/** Hand glyph optical size on the degree staff (100% baseline). */
export const HAND_SIGN_GLYPH_FONT_SIZE_PX = 40;

/** Size percent range (vector scale; 200 = 2× baseline, no bitmap upscale). */
export const HAND_SIGN_SIZE_PERCENT_MIN = 50;
export const HAND_SIGN_SIZE_PERCENT_MAX = 200;
export const HAND_SIGN_SIZE_PERCENT_STEP = 1;

/** Contrast weight 0…1 (stroke thickness relative to font size). */
export const HAND_SIGN_CONTRAST_MIN = 0;
export const HAND_SIGN_CONTRAST_MAX = 1;
/** Max stroke as fraction of fontSize at contrast = 1. */
export const HAND_SIGN_CONTRAST_STROKE_FRAC = 0.1;

export const DEFAULT_HAND_SIGN_STYLE = Object.freeze({
  sizePercent: 100,
  contrast: 0,
  /** C-režiim: 7 horisontaalset astmejoont (käemärgid on kõrguselt juba astmete järgi). */
  showDegreeLines: true,
});

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Normalize persisted / UI hand-sign style. Does not alter font files (CC BY-NC-ND).
 * Accepts legacy `{ sizeScale, contrast: 'normal'|'strong' }` and maps to continuous fields.
 * @param {unknown} value
 * @returns {{ sizePercent: number, contrast: number, showDegreeLines: boolean }}
 */
export function normalizeHandSignStyle(value) {
  const raw = value && typeof value === 'object' ? value : {};

  let sizePercent;
  if (raw.sizePercent != null && Number.isFinite(Number(raw.sizePercent))) {
    sizePercent = Number(raw.sizePercent);
  } else if (raw.sizeScale != null && Number.isFinite(Number(raw.sizeScale))) {
    sizePercent = Number(raw.sizeScale) * 100;
  } else {
    sizePercent = 100;
  }
  sizePercent = Math.round(clamp(sizePercent, HAND_SIGN_SIZE_PERCENT_MIN, HAND_SIGN_SIZE_PERCENT_MAX));

  let contrast;
  if (typeof raw.contrast === 'string') {
    contrast = raw.contrast === 'strong' ? 0.55 : 0;
  } else if (raw.contrast != null && Number.isFinite(Number(raw.contrast))) {
    contrast = Number(raw.contrast);
  } else {
    contrast = 0;
  }
  contrast = clamp(contrast, HAND_SIGN_CONTRAST_MIN, HAND_SIGN_CONTRAST_MAX);
  // Keep one decimal for stable slider/persist (0.0 … 1.0)
  contrast = Math.round(contrast * 100) / 100;

  // Default true: omit / null / undefined → show lines; only explicit false hides.
  const showDegreeLines = raw.showDegreeLines !== false;

  return { sizePercent, contrast, showDegreeLines };
}

/**
 * Resolve glyph paint + staff metrics from handSignStyle.
 * Larger size also widens degree-line spacing so glyphs do not collide.
 * Contrast maps to SVG stroke weight (vector; not pixelated).
 * @param {{ sizePercent?: number, contrast?: number } | null | undefined} style
 * @param {{ ink?: string } | undefined} options
 */
export function resolveHandSignGlyphMetrics(style, options = {}) {
  const { sizePercent, contrast } = normalizeHandSignStyle(style);
  const sizeScale = sizePercent / 100;
  const ink = options.ink || '#1a1a1a';
  const fontSize = Math.round(HAND_SIGN_GLYPH_FONT_SIZE_PX * sizeScale);
  const lineSpacing = Math.round(HAND_SIGN_DEGREE_LINE_SPACING_PX * sizeScale);
  const strokeWidth = contrast <= 0
    ? 0
    : Math.max(0.35, fontSize * HAND_SIGN_CONTRAST_STROKE_FRAC * contrast);
  const fill = contrast >= 0.85 ? '#000000' : ink;
  return {
    sizePercent,
    contrast,
    sizeScale,
    fontSize,
    lineSpacing,
    fill,
    stroke: strokeWidth > 0 ? '#000000' : 'none',
    strokeWidth,
  };
}

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
