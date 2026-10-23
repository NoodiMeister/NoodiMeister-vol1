/**
 * Hand-tool manual placements that must survive save/load (clef + jump marks).
 * Kept separate from React so restore paths share one normalizer + regression checks.
 */

const SIZE_MIN = 1;
const SIZE_MAX = 700;

function normalizeSizePx(raw) {
  if (raw == null || raw === '') return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.max(SIZE_MIN, Math.min(SIZE_MAX, n));
}

/** @returns {{ x: number, y: number, sizePx: number|null }} */
export function normalizeClefHandOffset(raw) {
  if (!raw || typeof raw !== 'object') return { x: 0, y: 0, sizePx: null };
  const x = Number(raw.x);
  const y = Number(raw.y);
  return {
    x: Number.isFinite(x) ? Math.round(x) : 0,
    y: Number.isFinite(y) ? Math.round(y) : 0,
    sizePx: normalizeSizePx(raw.sizePx),
  };
}

/**
 * @param {unknown} raw
 * @returns {Record<string, { dx: number, dy: number, sizePx: number|null }>}
 */
export function normalizeJumpMarkLayoutOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!key || !val || typeof val !== 'object') continue;
    const dx = Number(val.dx);
    const dy = Number(val.dy);
    out[String(key)] = {
      dx: Number.isFinite(dx) ? Math.round(dx) : 0,
      dy: Number.isFinite(dy) ? Math.round(dy) : 0,
      sizePx: normalizeSizePx(val.sizePx),
    };
  }
  return out;
}

/** True when clef offset/size differs from defaults (worth writing into project JSON). */
export function clefHandOffsetIsNonDefault(offset) {
  const n = normalizeClefHandOffset(offset);
  return n.x !== 0 || n.y !== 0 || n.sizePx != null;
}
