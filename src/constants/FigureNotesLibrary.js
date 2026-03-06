/**
 * Figurenotes sümbolite süsteem: kujund ja värv noodinime (C–B) järgi.
 * Oktavi reeglid: getFigureStyle(octave) muudab täidet, piirjoont ja mustrit.
 */

export const FIGURE_SHAPES_DATA = {
  C: { name: 'DO', color: '#E30613', path: 'M5,5 h90 v90 h-90 z' }, // Punane ruut
  D: { name: 'RE', color: '#89512E', path: 'M50,5 a45,45 0 1,0 0,90 a45,45 0 1,0 0,-90' }, // Pruun ring
  E: { name: 'MI', color: '#FFD400', path: 'M50,5 L95,90 L5,90 z' }, // Kollane kolmnurk
  F: { name: 'FA', color: '#009640', path: 'M10,25 h80 v50 h-80 z' }, // Roheline ristkülik
  G: { name: 'SOL', color: '#004A99', path: 'M50,5 L63,38 L95,38 L69,59 L79,91 L50,71 L21,91 L31,59 L5,38 L37,38 z' }, // Sinine täht
  A: { name: 'LA', color: '#E3007F', path: 'M50,5 L95,50 L50,95 L5,50 z' }, // Lilla romb
  B: { name: 'SI', color: '#FFFFFF', path: 'M50,5 a45,25 0 1,0 0,50 a45,25 0 1,0 0,-50', stroke: '#000' }, // Valge ovaal
};

/** H-võti (sama mis B). */
export function getShapeData(noteName) {
  const p = noteName && String(noteName).toUpperCase().replace('H', 'B');
  return FIGURE_SHAPES_DATA[p] || FIGURE_SHAPES_DATA[p?.charAt(0)] || FIGURE_SHAPES_DATA.C;
}

function darkenHex(hex, amount = 0.3) {
  const h = String(hex).replace('#', '').trim();
  if (h.length !== 6) return hex;
  const a = Math.min(1, Math.max(0, amount));
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const rr = Math.round(r * (1 - a));
  const gg = Math.round(g * (1 - a));
  const bb = Math.round(b * (1 - a));
  return `#${rr.toString(16).padStart(2, '0')}${gg.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`;
}

/**
 * Oktavi stiil Figurenotes sümbolile (oktavid 2–6).
 * - 2: fill + rist sees (showCross)
 * - 3: tumedam fill
 * - 4: puhas fill
 * - 5: fill + must piirjoon
 * - 6: ainult värviline raam (fill none)
 */
export function getFigureStyle(noteName, octave) {
  const base = getShapeData(noteName);
  const octaveNum = Number(octave);

  switch (octaveNum) {
    case 2:
      return { fill: base.color, opacity: 0.9, showCross: true, stroke: '#000', strokeWidth: 2 };
    case 3:
      return { fill: darkenHex(base.color, 0.3) };
    case 4:
      return { fill: base.color };
    case 5:
      return { fill: base.color, stroke: '#000', strokeWidth: 5 };
    case 6:
      return { fill: 'none', stroke: base.color, strokeWidth: 8 };
    default:
      return { fill: base.color };
  }
}

/** Värvid noodinime järgi (klaviatuur, taustabandid). B/H sama. */
export function getFigureColor(noteName) {
  return getShapeData(noteName).color;
}
