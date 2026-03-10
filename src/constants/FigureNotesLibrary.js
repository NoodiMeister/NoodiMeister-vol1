/**
 * Figurenotes: 4 octaves (2–5), 7 notes per octave (C–B).
 * SHAPE = by octave only. COLOR = by note only.
 * Octave 2: X-shape (cross)
 * Octave 3: square
 * Octave 4: circle
 * Octave 5: triangle
 *
 * Colors (by note): C=RED, D=BROWN, E=GREY, F=BLUE, G=BLACK, A=YELLOW, B=GREEN.
 */

/** Note name → color only. Same color in every octave. */
export const FIGURE_NOTE_COLORS = {
  C: '#E30613',   // RED
  D: '#89512E',   // BROWN
  E: '#6b7280',   // GREY
  F: '#2563eb',   // BLUE
  G: '#000000',   // BLACK
  A: '#eab308',   // YELLOW
  B: '#22c55e',   // GREEN
};

/** Note name → solfège label (DO, RE, …). */
export const FIGURE_NOTE_NAMES = {
  C: 'DO',
  D: 'RE',
  E: 'MI',
  F: 'FA',
  G: 'SOL',
  A: 'LA',
  B: 'SI',
};

/** Octave 2: X-shape (two hexagons, viewBox 0 0 100 100). */
const OCTAVE_2_PATHS = [
  'M10 10 L30 10 L90 70 L90 90 L70 90 L10 30 Z',
  'M90 10 L70 10 L10 70 L10 90 L30 90 L90 30 Z',
];
/** Octave 3: square. */
const OCTAVE_3_PATH = 'M5,5 h90 v90 h-90 z';
/** Octave 4: circle. */
const OCTAVE_4_PATH = 'M50,5 a45,45 0 1,0 0,90 a45,45 0 1,0 0,-90';
/** Octave 5: triangle (tip up). */
const OCTAVE_5_PATH = 'M50,5 L95,90 L5,90 z';

/**
 * Shape path(s) by octave (2–5). All in viewBox 0 0 100 100.
 * Octave 2 returns two paths (X); others return one path.
 * @param {number} octave – scientific octave (2, 3, 4, 5)
 * @returns {string[]} – array of SVG path d strings
 */
export function getShapePathsByOctave(octave) {
  const o = Number(octave);
  if (o === 2) return [...OCTAVE_2_PATHS];
  if (o === 3) return [OCTAVE_3_PATH];
  if (o === 4) return [OCTAVE_4_PATH];
  if (o === 5) return [OCTAVE_5_PATH];
  return [OCTAVE_4_PATH]; // fallback: circle
}

/**
 * Single path for octave (for octave 2, first path of the X; use getShapePathsByOctave(2) for both).
 * @param {number} octave
 * @returns {string}
 */
export function getShapePathByOctave(octave) {
  const paths = getShapePathsByOctave(octave);
  return paths[0] ?? OCTAVE_4_PATH;
}

/** Normalize note name (H → B). */
function normalizeNote(noteName) {
  return noteName && String(noteName).toUpperCase().replace('H', 'B');
}

/** Color for note (C–B). B and H same. */
export function getFigureColor(noteName) {
  const p = normalizeNote(noteName);
  return FIGURE_NOTE_COLORS[p] ?? FIGURE_NOTE_COLORS.C;
}

/** { name, color } for note (no path – shape comes from octave). */
export function getShapeData(noteName) {
  const p = normalizeNote(noteName);
  const color = FIGURE_NOTE_COLORS[p] ?? FIGURE_NOTE_COLORS.C;
  const name = FIGURE_NOTE_NAMES[p] ?? 'DO';
  return { name, color };
}

/**
 * Fill and optional stroke for drawing a figure (note + octave).
 * Shape is drawn with getShapePathsByOctave(octave); this returns the fill color (by note).
 * G (black): no stroke so it’s visible on dark keys.
 */
export function getFigureStyle(noteName, octave) {
  const fill = getFigureColor(noteName);
  const isBlack = !fill || fill === '#000000' || String(fill).toLowerCase() === 'black';
  return {
    fill,
    stroke: isBlack ? 'none' : '#000',
    strokeWidth: isBlack ? 0 : 2,
  };
}

/**
 * For octave-2 X shape: fill by note (same as getFigureColor). Used when drawing the two X paths.
 * G (black): no stroke.
 */
export function getOctave2CrossStyle(noteName) {
  const fill = getFigureColor(noteName);
  const isBlack = !fill || fill === '#000000' || String(fill).toLowerCase() === 'black';
  return {
    fill,
    stroke: isBlack ? 'none' : '#000',
    strokeWidth: isBlack ? 0 : 1,
  };
}

/** Legacy: FIGURE_SHAPES_DATA as note → { name, color } (no path). For code that still expects this shape. */
export const FIGURE_SHAPES_DATA = Object.fromEntries(
  Object.entries(FIGURE_NOTE_COLORS).map(([k, v]) => [
    k,
    { name: FIGURE_NOTE_NAMES[k], color: v },
  ])
);
