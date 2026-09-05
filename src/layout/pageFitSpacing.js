const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 40;

export const SPACING_PRESET_NORMAL_PX = 85;
export const SPACING_PRESET_LOOSE_PX = 120;

/** Figuurnotatsiooni rea kasutatav laius (lehe sisu − ääred − ohutus). */
export function getFigureContentWidthPx(pageWidthPx, figurenotesSize = 16) {
  const figureSizeBase = Math.max(12, Math.min(96, Number(figurenotesSize) || 85));
  const edgeSafetyPadPx = Math.max(0, Math.round(figureSizeBase * 0.6));
  const rawEffectiveWidth = typeof pageWidthPx === 'number' && pageWidthPx > 0
    ? Math.max(200, pageWidthPx - MARGIN_LEFT - MARGIN_RIGHT)
    : 200;
  return Math.max(200, rawEffectiveWidth - edgeSafetyPadPx);
}

/** Max px/löök, et `measuresPerLine` takti mahuks lehe reale (nt 4 takti 4/4). */
export function maxPixelsPerBeatToFitPage({
  contentWidthPx,
  measuresPerLine,
  beatsPerMeasure,
  minPx = 12,
} = {}) {
  const n = Math.max(1, Math.round(Number(measuresPerLine) || 1));
  const beats = Math.max(0.25, Number(beatsPerMeasure) || 4);
  const width = Math.max(1, Number(contentWidthPx) || 1);
  const min = Math.max(1, Number(minPx) || 1);
  return Math.max(min, width / (n * beats));
}

export function clampPixelsPerBeatToPage(desiredPx, maxFitPx, minPx = 12) {
  const desired = Number(desiredPx);
  const maxFit = Number(maxFitPx);
  const lo = Math.max(1, Number(minPx) || 1);
  const d = Number.isFinite(desired) && desired > 0 ? desired : SPACING_PRESET_NORMAL_PX;
  if (!Number.isFinite(maxFit) || maxFit <= 0) return Math.max(lo, d);
  const limited = Math.min(d, maxFit);
  return Math.max(Math.min(lo, maxFit), limited);
}

export function fitWidthsToContentWidth(widths, contentWidth) {
  const sum = widths.reduce((a, b) => a + (Number(b) || 0), 0);
  const limit = Number(contentWidth);
  if (!(sum > 0) || !Number.isFinite(limit) || !(sum > limit)) return widths;
  const scale = limit / sum;
  return widths.map((w) => (Number(w) || 0) * scale);
}
