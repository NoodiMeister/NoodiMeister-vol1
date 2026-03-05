/**
 * Figuurnotatsiooni kujundite ja värvide süsteem.
 * Värv sõltub noodi nimest (C, D, …), kujund sõltub oktaavist (teaduslik oktaav 0–7+).
 */

/** Värvid noodinime järgi. B ja H mõlemad roheline. */
export const FIGURENOTES_COLORS = {
  C: '#FF0000',
  D: '#8B4513',
  E: '#808080',
  F: '#0000FF',
  G: '#000000',
  A: '#FFFF00',
  B: '#008000',
  H: '#008000',
};

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
  const p = pitch && String(pitch).toUpperCase().replace('H', 'B');
  return FIGURENOTES_COLORS[p] || FIGURENOTES_COLORS[p?.charAt(0)] || '#000000';
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
