/**
 * Iirivile / plokkflöödi SVG-augudiagrammi geomeetria (üks tõde renderile + layout-varule).
 *
 * Plokkflööt on pikem kui iirivile:
 * - pöial ülemise (1.) sõrmeaugu kõrval vasakul
 * - seejärel 7 sõrmeauku ülevalt alla
 * Iirivile: 6 auku tulbas (ilma pöidlata).
 */

export const WIND_FINGERING_TIN_WHISTLE_HOLES = 6;
export const WIND_FINGERING_RECORDER_HOLES = 7;

/**
 * @param {number} staffSpace
 * @param {number} [scale=1]
 * @returns {{ scale: number, ss: number, radius: number, gap: number, strokeWidth: number, fontSize: number }}
 */
export function getWindFingeringHoleMetrics(staffSpace, scale = 1) {
  const s = typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? scale : 1;
  const ss = Math.max(1, Number(staffSpace) || 10) * s;
  const radius = Math.max(1.6, ss * 0.22);
  const gap = Math.max(3, ss * 0.75);
  const strokeWidth = Math.max(0.8, radius * 0.3);
  const fontSize = Math.max(7, ss * 0.9);
  return { scale: s, ss, radius, gap, strokeWidth, fontSize };
}

/**
 * Plokkflöödi pöidla keskpunkt suhtes 1. sõrmeaugu keset (lokaalne cx, cy).
 * Pöial = ülemise augu kõrval (sama kõrgus), mitte eraldi ülemine rida.
 */
export function getRecorderThumbOffset(radius, ss) {
  const r = Math.max(1.6, Number(radius) || 1.6);
  const space = Math.max(1, Number(ss) || 10);
  return {
    cx: -(2 * r + Math.max(2, space * 0.18)),
    cy: 0,
  };
}

/**
 * Tulba kõrgus ülemise augu keskpunktist alumise augu alumise servani (+ valikuline overblow "+").
 * @param {'tin-whistle'|'recorder'} kind
 */
export function getWindFingeringColumnHeightFromTopCenter(kind, staffSpace, scale = 1, { includeOverblow = true } = {}) {
  const { radius, gap, fontSize, ss } = getWindFingeringHoleMetrics(staffSpace, scale);
  const holeCount = kind === 'recorder' ? WIND_FINGERING_RECORDER_HOLES : WIND_FINGERING_TIN_WHISTLE_HOLES;
  const bottomOfLastHole = (holeCount - 1) * gap + radius;
  if (!includeOverblow) return bottomOfLastHole;
  const gapBelowColumn = Math.min(0.35 * gap, 10 + ss * 0.06);
  return bottomOfLastHole + gapBelowColumn + fontSize * 0.7;
}

/**
 * Layout-varu staffi all (ülemise augu baasnihke + tulba kõrgus), et järgmine süsteem ei kattuks.
 * Plokkflööt > iirivile (7 auku + pöial ei lisa kõrgust, aga 7 vs 6 teeb tulba pikemaks).
 */
export function estimateWindFingeringLayoutReservePx(kind, staffSpace, scale = 1) {
  const sp = Math.max(1, Number(staffSpace) || 10);
  const topOffsetFromLastStaffLine = sp * 1.55;
  const column = getWindFingeringColumnHeightFromTopCenter(kind, sp, scale, { includeOverblow: true });
  const pad = sp * 0.35;
  return Math.ceil(topOffsetFromLastStaffLine + column + pad);
}
