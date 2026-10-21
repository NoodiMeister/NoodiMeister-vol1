/**
 * Print/PDF overlay (tekstikastid jms) peab kasutama sama ankur-transformi mis noodigraafika stseen.
 * Koordinaadid on scoreContainer suhtes (nagu ekraanil).
 */

/**
 * @param {{ content?: { xPx?: number, yPx?: number }, score?: { offsetXPx?: number, offsetYPx?: number, scale?: number } } | null} layoutSnapshot
 * @returns {{ anchorX: number, anchorY: number, scale: number } | null}
 */
export function getScoreNotationExportTransform (layoutSnapshot) {
  if (!layoutSnapshot || typeof layoutSnapshot !== 'object') return null;
  const content = layoutSnapshot.content || {};
  const score = layoutSnapshot.score || {};
  return {
    anchorX: (Number(content.xPx) || 0) + (Number(score.offsetXPx) || 0),
    anchorY: (Number(content.yPx) || 0) + (Number(score.offsetYPx) || 0),
    scale: Math.max(0.25, Math.min(3, Number(score.scale) || 1)),
  };
}

/**
 * Map container (bx, by) through the same translate/scale stack as the notation scene group.
 *
 * @param {number} bx
 * @param {number} by
 * @param {{ anchorX?: number, anchorY?: number, scale?: number }} overlayTransform
 */
export function buildContainerOverlayGroupTransform (bx, by, overlayTransform) {
  const ax = Number(overlayTransform?.anchorX) || 0;
  const ay = Number(overlayTransform?.anchorY) || 0;
  const s = Math.max(0.25, Math.min(3, Number(overlayTransform?.scale) || 1));
  const lx = ((Number(bx) || 0) - ax) / s;
  const ly = ((Number(by) || 0) - ay) / s;
  return `translate(${ax}, ${ay}) scale(${s}) translate(${lx}, ${ly})`;
}
