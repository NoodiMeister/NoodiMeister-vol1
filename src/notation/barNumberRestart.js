/**
 * Display bar number for a measure, respecting section restarts (uus lugu / harjutus)
 * and optional pickup (anacrusis) which has no number when it is still in the first section.
 *
 * @param {number} measureIndex 0-based measure index
 * @param {{ pickupEnabled?: boolean, barNumberRestartAt?: number[] }} options
 * @returns {number|null}
 */
export function getDisplayBarNumber(measureIndex, { pickupEnabled = false, barNumberRestartAt = [] } = {}) {
  if (!Number.isInteger(measureIndex) || measureIndex < 0) return null;
  const restarts = Array.isArray(barNumberRestartAt) ? barNumberRestartAt : [];
  let restartBase = 0;
  for (const r of restarts) {
    const idx = Number(r);
    if (Number.isInteger(idx) && idx <= measureIndex && idx > restartBase) restartBase = idx;
  }
  if (pickupEnabled && measureIndex === 0 && restartBase === 0) return null;
  const pickupAdjust = pickupEnabled && restartBase === 0 ? 1 : 0;
  return measureIndex - restartBase + 1 - pickupAdjust;
}
