/**
 * Pidekaar (tie) ja legato kaar (slur): SVG cubic bezier — sümmeetriline graveeringu-stiil.
 * Y kasvab allapoole; bulgeY negatiivne = kõver ülespoole.
 */

/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {object} opts
 * @param {boolean} [opts.bulgeUp] — kui true, lüük kõver ülespoole (ülesvars / ülemine kiht)
 * @param {number} [opts.spacing] — staffSpace (skaleerimine)
 * @param {'tie' | 'slur'} [opts.kind]
 * @returns {string} path d
 */
export function getTieSlurPathD(x1, y1, x2, y2, opts = {}) {
  const kind = opts.kind || 'slur';
  const spacing = typeof opts.spacing === 'number' && Number.isFinite(opts.spacing) && opts.spacing > 0
    ? opts.spacing
    : 10;
  const span = Math.abs(x2 - x1);
  const hBase = kind === 'tie'
    ? Math.max(3, spacing * 0.5)
    : Math.min(28, Math.max(6, 6 + span * 0.1));
  const yMid = (y1 + y2) / 2;
  const bulgeUp = opts.bulgeUp !== false;
  const cY = yMid + (bulgeUp ? -hBase : hBase);
  const t = 0.4;
  const c1x = x1 + (x2 - x1) * t;
  const c2x = x1 + (x2 - x1) * (1 - t);
  return `M ${x1} ${y1} C ${c1x} ${cY} ${c2x} ${cY} ${x2} ${y2}`;
}

/** Envelope (finaallüüs): kitsam kui sluur, kui soovitakse “õhuke” pais */
export function getTiePathD(x1, y1, x2, y2, { spacing, bulgeUp } = {}) {
  return getTieSlurPathD(x1, y1, x2, y2, { kind: 'tie', spacing, bulgeUp });
}
