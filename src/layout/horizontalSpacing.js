/**
 * MuseScore / Dorico style horizontal note spacing.
 *
 * Model (MuseScore 4.5+ / Dorico):
 * - quarter note has a reference width (`quarterWidthPx` ≈ pixelsPerBeat)
 * - longer/shorter values scale by `spacingRatio` per duration doubling
 *   width(d) = quarterWidth * ratio^log2(d)   (d in quarter-note beats)
 * - never below `minNoteDistancePx` (collision floor)
 * - measure natural width = sum of spring segments between consecutive onsets
 *
 * Default ratio √2 ≈ Gould / Dorico (not linear time, not flat).
 */

export const DEFAULT_SPACING_RATIO = Math.SQRT2;
export const TRADITIONAL_MIN_NOTE_DISTANCE_SP = 1.2;
export const FIGURE_MIN_NOTE_GAP_PX = 4;

const EPS = 1e-6;

export function spacingWidthForDurationBeats(durationBeats, {
  quarterWidthPx = 85,
  spacingRatio = DEFAULT_SPACING_RATIO,
  minNoteDistancePx = 12,
} = {}) {
  const d = Math.max(1 / 64, Number(durationBeats) || 1);
  const ratio = Math.max(1, Number(spacingRatio) || DEFAULT_SPACING_RATIO);
  const wq = Math.max(1, Number(quarterWidthPx) || 85);
  const minDist = Math.max(1, Number(minNoteDistancePx) || 1);
  const width = wq * (ratio ** Math.log2(d));
  return Math.max(minDist, width);
}

export function traditionalMinNoteDistancePx(staffSpacePx = 10) {
  const sp = Math.max(4, Number(staffSpacePx) || 10);
  return sp * TRADITIONAL_MIN_NOTE_DISTANCE_SP;
}

/**
 * Figurenotes collision floor for the shortest value in play.
 * Visual scale matches FigurenotesView: 1/8 → 0.5, 1/16|1/32 → 0.25.
 */
export function figurenotesMinNoteDistancePx(figurenotesSize = 85, shortestDurationBeats = 1) {
  const size = Math.max(12, Math.min(96, Number(figurenotesSize) || 85));
  const d = Number(shortestDurationBeats);
  const scale = (Number.isFinite(d) && d > 0 && d <= 0.25 + EPS)
    ? 0.25
    : (Number.isFinite(d) && d > 0 && d <= 0.5 + EPS ? 0.5 : 1);
  return size * scale + FIGURE_MIN_NOTE_GAP_PX;
}

function noteDurationBeats(note) {
  const d = Number(note?.duration);
  return Number.isFinite(d) && d > 0 ? d : 1;
}

function collectOnsetBeats(notes, startBeat, endBeat) {
  const set = new Set();
  const start = Number(startBeat) || 0;
  const end = Number(endBeat);
  const endSafe = Number.isFinite(end) && end > start ? end : start + 4;
  for (const n of notes || []) {
    const b = Number(n?.beat);
    if (!Number.isFinite(b)) continue;
    if (b < start - EPS || b >= endSafe - EPS) continue;
    set.add(Math.round(b * 1024) / 1024);
  }
  const onsets = [...set].sort((a, b) => a - b);
  return { onsets, start, end: endSafe };
}

export function shortestDurationBeatsInNotes(notes, startBeat, endBeat) {
  const start = Number(startBeat) || 0;
  const end = Number(endBeat);
  const endSafe = Number.isFinite(end) && end > start ? end : start + 4;
  let minD = Infinity;
  for (const n of notes || []) {
    const b = Number(n?.beat);
    if (!Number.isFinite(b) || b < start - EPS || b >= endSafe - EPS) continue;
    minD = Math.min(minD, noteDurationBeats(n));
  }
  return Number.isFinite(minD) ? minD : 1;
}

/**
 * Build spring segments for one measure.
 * @returns {{
 *   boundaries: number[],
 *   segmentWidths: number[],
 *   naturalWidth: number,
 *   shortestDurationBeats: number,
 * }}
 */
export function buildMeasureSpacingModel(notes, {
  startBeat = 0,
  endBeat,
  beatCount = 4,
  quarterWidthPx = 85,
  spacingRatio = DEFAULT_SPACING_RATIO,
  minNoteDistancePx = 12,
} = {}) {
  const beats = Math.max(0.25, Number(beatCount) || 4);
  const start = Number(startBeat) || 0;
  const end = Number.isFinite(Number(endBeat)) ? Number(endBeat) : start + beats;
  const opts = { quarterWidthPx, spacingRatio, minNoteDistancePx };
  const baseWidth = beats * Math.max(1, Number(quarterWidthPx) || 85);

  const { onsets } = collectOnsetBeats(notes, start, end);
  const shortestDurationBeats = shortestDurationBeatsInNotes(notes, start, end);

  if (onsets.length === 0) {
    const segmentWidths = Array.from({ length: Math.max(1, Math.round(beats)) }, () => (
      spacingWidthForDurationBeats(1, opts)
    ));
    // Prefer exact beatCount * quarter when empty (stable empty bars).
    const naturalWidth = Math.max(baseWidth, segmentWidths.reduce((a, b) => a + b, 0));
    const boundaries = Array.from({ length: Math.round(beats) + 1 }, (_, i) => start + i);
    return {
      boundaries: boundaries.length >= 2 ? boundaries : [start, end],
      segmentWidths: segmentWidths.length ? segmentWidths : [baseWidth],
      naturalWidth,
      shortestDurationBeats: 1,
    };
  }

  const boundaries = [start];
  for (const o of onsets) {
    if (o > boundaries[boundaries.length - 1] + EPS) boundaries.push(o);
  }
  if (end > boundaries[boundaries.length - 1] + EPS) boundaries.push(end);
  else if (Math.abs(end - boundaries[boundaries.length - 1]) > EPS) {
    boundaries[boundaries.length - 1] = end;
  }

  const segmentWidths = [];
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const dur = Math.max(1 / 64, boundaries[i + 1] - boundaries[i]);
    segmentWidths.push(spacingWidthForDurationBeats(dur, opts));
  }
  const springSum = segmentWidths.reduce((a, b) => a + b, 0);
  return {
    boundaries,
    segmentWidths,
    naturalWidth: Math.max(baseWidth, springSum),
    shortestDurationBeats,
  };
}

export function naturalMeasureWidthFromNotes(notes, options) {
  return buildMeasureSpacingModel(notes, options).naturalWidth;
}

function scaledSegmentPrefix(model, measureWidth) {
  const widths = model.segmentWidths || [];
  const natural = Math.max(EPS, Number(model.naturalWidth) || widths.reduce((a, b) => a + b, 0));
  const target = Math.max(EPS, Number(measureWidth) || natural);
  const scale = target / natural;
  const scaled = widths.map((w) => (Number(w) || 0) * scale);
  const prefix = [0];
  for (let i = 0; i < scaled.length; i += 1) prefix.push(prefix[i] + scaled[i]);
  return { scaled, prefix, scale };
}

/** Map an absolute beat to X inside a measure (MuseScore spring timeline). */
export function xAtBeatInMeasure(absoluteBeat, model, measureX, measureWidth) {
  const left = Number(measureX) || 0;
  const boundaries = model?.boundaries || [];
  if (boundaries.length < 2) return left;
  const { scaled, prefix } = scaledSegmentPrefix(model, measureWidth);
  const beat = Number(absoluteBeat);
  if (!Number.isFinite(beat)) return left;

  if (beat <= boundaries[0] + EPS) return left;
  const last = boundaries[boundaries.length - 1];
  if (beat >= last - EPS) return left + (Number(measureWidth) || 0);

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const a = boundaries[i];
    const b = boundaries[i + 1];
    if (beat < b - EPS || i === boundaries.length - 2) {
      const denom = Math.max(EPS, b - a);
      const t = Math.max(0, Math.min(1, (beat - a) / denom));
      return left + prefix[i] + t * scaled[i];
    }
  }
  return left + (Number(measureWidth) || 0);
}

/**
 * Notehead X: MuseScore places the head at the onset of its spring segment
 * (optical center ≈ onset + small inset). We use onset + half of the note's
 * own duration span along the spring timeline so beamed runs stay readable.
 */
export function noteCenterXInMeasure(note, model, measureX, measureWidth) {
  const beat = Number(note?.beat);
  if (!Number.isFinite(beat)) return Number(measureX) || 0;
  const dur = noteDurationBeats(note);
  // Optical center of the note's allocated time span (onset → onset+dur),
  // clamped to the measure spring model.
  const endBeat = beat + Math.max(EPS, dur);
  const x0 = xAtBeatInMeasure(beat, model, measureX, measureWidth);
  const x1 = xAtBeatInMeasure(endBeat, model, measureX, measureWidth);
  return (x0 + x1) / 2;
}

/**
 * Convenience factory for views / cursor / export.
 */
export function createMeasureHorizontalLayout({
  notes = [],
  startBeat = 0,
  endBeat,
  beatCount = 4,
  measureX = 0,
  measureWidth,
  quarterWidthPx = 85,
  spacingRatio = DEFAULT_SPACING_RATIO,
  minNoteDistancePx = 12,
} = {}) {
  const model = buildMeasureSpacingModel(notes, {
    startBeat,
    endBeat,
    beatCount,
    quarterWidthPx,
    spacingRatio,
    minNoteDistancePx,
  });
  const width = Number(measureWidth) > 0 ? Number(measureWidth) : model.naturalWidth;
  return {
    model,
    naturalWidth: model.naturalWidth,
    measureWidth: width,
    xAtBeat: (beat) => xAtBeatInMeasure(beat, model, measureX, width),
    noteCenterX: (note) => noteCenterXInMeasure(note, model, measureX, width),
    slotWidthNearBeat: (beat) => {
      const b = Number(beat);
      const boundaries = model.boundaries || [];
      const { scaled } = scaledSegmentPrefix(model, width);
      for (let i = 0; i < boundaries.length - 1; i += 1) {
        if (b >= boundaries[i] - EPS && b < boundaries[i + 1] - EPS) return scaled[i];
      }
      return scaled[scaled.length - 1] || width;
    },
  };
}
