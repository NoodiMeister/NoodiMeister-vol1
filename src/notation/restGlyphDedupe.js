const DEFAULT_EPS = 1e-5;

/**
 * Mitu sama või üksteise sisse jäävat pausi ühes taktis tekitavad traditsioonivaates
 * SMuFL-i peale joonistamise ja figuurnotatsioonis Z-märgi kihistumise.
 *
 * Tagastab false, kui selle elemendi pausiglyph + rütmisilp tuleks jätta joonistamata
 * (varasem sama taktis olev paus katab aja juba visuaalselt). Klõpsuala saab ikkagi
 * parent `<g>` alla lisada läbipaistva ristkülikuga.
 *
 * @param {Array<{ beat?: number, duration?: number, isRest?: boolean }>|null|undefined} measureNotes
 * @param {number} index
 * @param {number} [eps]
 * @returns {boolean}
 */
export function shouldDrawRestGlyph(measureNotes, index, eps = DEFAULT_EPS) {
  const n = measureNotes?.[index];
  if (!n?.isRest) return true;

  const bi = Number(n.beat) || 0;
  const di = Number(n.duration) || 1;
  const ei = bi + di;
  if (!Number.isFinite(bi) || !Number.isFinite(ei)) return true;

  for (let j = 0; j < measureNotes.length; j += 1) {
    if (j === index) continue;
    const m = measureNotes[j];
    if (!m?.isRest) continue;

    const bj = Number(m.beat) || 0;
    const dj = Number(m.duration) || 1;
    const ej = bj + dj;
    if (!Number.isFinite(bj) || !Number.isFinite(ej)) continue;

    const containedInJ = bj <= bi + eps && ej >= ei - eps;
    if (!containedInJ) continue;

    const spanI = ei - bi;
    const spanJ = ej - bj;
    const strictlyWider = spanJ > spanI + eps;
    const duplicate = Math.abs(bi - bj) < eps && Math.abs(di - dj) < eps;

    if (strictlyWider) return false;
    if (duplicate && j < index) return false;
  }
  return true;
}
