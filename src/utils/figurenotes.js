/**
 * Figurenotes: shape by octave (2=X, 3=square, 4=circle, 5=triangle), color by note (C–B).
 * Single source: FigureNotesLibrary (FIGURE_NOTE_COLORS, getShapePathsByOctave).
 */

import { FIGURE_NOTE_COLORS, getShapeData } from '../constants/FigureNotesLibrary';

/** Colors by note name (keyboard, etc.). B and H same. */
export const FIGURENOTES_COLORS = { ...FIGURE_NOTE_COLORS, H: FIGURE_NOTE_COLORS.B };

/**
 * Shape name by scientific octave (for timeline/piano when drawing by shape name).
 * Octave 2 = X (cross), 3 = square, 4 = circle, 5 = triangle.
 */
export function getFigureShape(octave) {
  const o = Number(octave);
  if (!Number.isFinite(o)) return 'circle';
  if (o <= 1) return 'none';
  if (o === 2) return 'cross';
  if (o === 3) return 'square';
  if (o === 4) return 'circle';
  if (o === 5) return 'triangle';
  if (o === 6) return 'triangleDown';
  return 'triangleDown';
}

/** Värv noodinime (pitch) järgi. */
export function getFigureColor(pitch) {
  return getShapeData(pitch).color;
}

/**
 * Tagastab figuuri sümboli: { color, shape }.
 * @param {string} pitch – noodi täht (C, D, E, F, G, A, B või H)
 * @param {number} octave – teaduslik oktaav (nt 4 = kesk-C)
 */
export function getFigureSymbol(pitch, octave) {
  return {
    color: getFigureColor(pitch),
    shape: getFigureShape(octave),
  };
}
