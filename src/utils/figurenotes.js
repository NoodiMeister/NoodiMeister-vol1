/**
 * Figuurnotatsiooni kujundite ja värvide süsteem.
 * Värvid sünkroonitud FigureNotesLibrary FIGURE_SHAPES_DATA-ga (C=punane ruut, D=pruun ring jne).
 */

import { FIGURE_SHAPES_DATA, getShapeData } from '../constants/FigureNotesLibrary';

/** Värvid noodinime järgi (klaviatuur jms). B ja H sama kujund. */
export const FIGURENOTES_COLORS = Object.fromEntries(
  Object.entries(FIGURE_SHAPES_DATA).map(([k, v]) => [k, v.color])
);
FIGURENOTES_COLORS.H = FIGURE_SHAPES_DATA.B.color;

/**
 * Kujund teadusliku oktaavi järgi:
 * 1. oktaav (kontra/suur): puudub
 * 2. oktaav (väike): rist (+)
 * 3. oktaav (kesk-C): ruut
 * 4. oktaav: ring
 * 5. oktaav: kolmnurk (tipp üles)
 * 6. oktaav: tagurpidi kolmnurk (tipp alla)
 * Teaduslik oktaav: C4 = 4, C3 = 3 jne.
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
