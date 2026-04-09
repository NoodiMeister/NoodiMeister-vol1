/**
 * Hard floor for horizontal spacing between adjacent glyph blocks.
 * Keeps SMuFL/text glyphs visually separated and avoids overlaps.
 */
export const MIN_GLYPH_HORIZONTAL_GAP_PX = 5;
export const MAX_GLYPH_HORIZONTAL_GAP_PX = 8;

export function ensureGlyphHorizontalGapPx(px) {
  const n = Number(px);
  if (!Number.isFinite(n)) return MIN_GLYPH_HORIZONTAL_GAP_PX;
  return Math.min(MAX_GLYPH_HORIZONTAL_GAP_PX, Math.max(MIN_GLYPH_HORIZONTAL_GAP_PX, n));
}

// Backwards-compatible alias for existing call sites.
export function ensureMinGlyphHorizontalGapPx(px) {
  return ensureGlyphHorizontalGapPx(px);
}
