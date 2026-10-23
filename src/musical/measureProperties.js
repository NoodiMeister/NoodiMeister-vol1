/**
 * Per-takt Actual kestus (MuseScore Measure Properties).
 * Nominal = skoori timeSignature; Actual override ei muuda globaalset taktimõõtu.
 */

import { measureLengthInQuarterBeats } from './timeSignature.js';
import {
  getPickupQuarterBeats,
  getLastMeasureQuarterBeats,
} from './pickup.js';

/**
 * @typedef {{ actualBeats?: number, excludeFromCount?: boolean, stretch?: number }} MeasurePropEntry
 * @typedef {Record<string|number, MeasurePropEntry>} MeasurePropsByIndex
 */

export function normalizeMeasurePropsByIndex(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const idx = parseInt(k, 10);
    if (!Number.isInteger(idx) || idx < 0 || !v || typeof v !== 'object') continue;
    const entry = {};
    const ab = Number(v.actualBeats);
    if (Number.isFinite(ab) && ab >= 0.25) entry.actualBeats = Math.round(ab * 1000) / 1000;
    if (v.excludeFromCount != null) entry.excludeFromCount = !!v.excludeFromCount;
    const st = Number(v.stretch);
    if (Number.isFinite(st) && st > 0) entry.stretch = Math.max(0.25, Math.min(4, st));
    if (Object.keys(entry).length) out[idx] = entry;
  }
  return out;
}

export function getMeasureProp(propsByIndex, measureIndex) {
  const p = propsByIndex?.[measureIndex] ?? propsByIndex?.[String(measureIndex)];
  return p && typeof p === 'object' ? p : null;
}

/**
 * Vaikimisi Actual (enne kasutaja override'i) ühele taktile.
 */
export function defaultActualBeatsForIndex(measureIndex, {
  measureQuarters,
  pickupBeats = 0,
  incompleteLast = false,
  totalMeasures = 1,
} = {}) {
  const full = Number(measureQuarters) || 4;
  const first = pickupBeats > 0 ? pickupBeats : full;
  const last = getLastMeasureQuarterBeats({
    measureQuarters: full,
    pickupBeats,
    incompleteLast: !!incompleteLast && pickupBeats > 0,
    measureCount: totalMeasures,
  });
  if (measureIndex === 0) return first;
  if (measureIndex === totalMeasures - 1 && totalMeasures >= 2) return last;
  return full;
}

/**
 * Ehita taktide loend järjestikuste start/end beatidega + optional per-takt Actual.
 * Globaalne timeSignature jääb Nominal'iks; Actual on ainult beatCount.
 */
export function buildMeasuresWithProps({
  timeSignature,
  totalMeasures,
  pickupEnabled = false,
  pickupQuantity = 1,
  pickupDuration = '1/4',
  incompleteLastMeasure = false,
  measurePropsByIndex = {},
} = {}) {
  const measureQuarters = measureLengthInQuarterBeats(timeSignature);
  const pickupBeats = getPickupQuarterBeats({
    enabled: pickupEnabled,
    quantity: pickupQuantity,
    duration: pickupDuration,
    timeSignature,
  });
  const total = Math.max(1, Number(totalMeasures) || 1);
  const props = normalizeMeasurePropsByIndex(measurePropsByIndex);
  const measures = [];
  let startBeat = 0;
  for (let i = 0; i < total; i++) {
    const fallback = defaultActualBeatsForIndex(i, {
      measureQuarters,
      pickupBeats,
      incompleteLast: incompleteLastMeasure,
      totalMeasures: total,
    });
    const prop = getMeasureProp(props, i);
    const beatCount = (prop?.actualBeats != null && prop.actualBeats >= 0.25)
      ? prop.actualBeats
      : fallback;
    measures.push({
      startBeat,
      endBeat: startBeat + beatCount,
      beatCount,
      excludeFromCount: prop?.excludeFromCount === true
        || (pickupBeats > 0 && i === 0 && prop?.excludeFromCount !== false),
      notes: [],
    });
    startBeat += beatCount;
  }
  return measures;
}

/**
 * Kas takt läheb measures-per-line loendisse (0 = eeltakt / exclude).
 */
export function getMeasureCountWeightFromProps(measureIndex, measurePropsByIndex, {
  pickupEnabled = false,
} = {}) {
  const prop = getMeasureProp(measurePropsByIndex, measureIndex);
  if (prop?.excludeFromCount === true) return 0;
  if (prop?.excludeFromCount === false) return 1;
  if (pickupEnabled && measureIndex === 0) return 0;
  return 1;
}

/**
 * Remap measurePropsByIndex pärast insert (shift indices >= index by count).
 */
export function remapMeasurePropsAfterInsert(propsByIndex, insertIndex, count = 1) {
  const props = normalizeMeasurePropsByIndex(propsByIndex);
  const next = {};
  for (const [k, v] of Object.entries(props)) {
    const i = parseInt(k, 10);
    const ni = i >= insertIndex ? i + count : i;
    next[ni] = v;
  }
  return next;
}

/**
 * Remap pärast delete [startIdx..endIdx].
 */
export function remapMeasurePropsAfterDelete(propsByIndex, startIdx, endIdx) {
  const props = normalizeMeasurePropsByIndex(propsByIndex);
  const numDel = endIdx - startIdx + 1;
  const next = {};
  for (const [k, v] of Object.entries(props)) {
    const i = parseInt(k, 10);
    if (i >= startIdx && i <= endIdx) continue;
    const ni = i > endIdx ? i - numDel : i;
    next[ni] = v;
  }
  return next;
}

/**
 * Remap break-indeksid pärast insert (indices >= insertIndex += count).
 */
export function remapBreakIndicesAfterMeasureInsert(prevArr, insertIndex, count = 1) {
  if (!Array.isArray(prevArr) || prevArr.length === 0) return prevArr || [];
  return prevArr
    .map((i) => (Number(i) >= insertIndex ? Number(i) + count : Number(i)))
    .filter((i) => Number.isInteger(i) && i >= 0)
    .sort((a, b) => a - b);
}

/**
 * Lisa tühi ajaintervall [atBeat, atBeat+gap) — nihuta järgnevaid noote edasi.
 */
export function insertBeatGapIntoStaffNotes(staffNotes, atBeat, gapBeats) {
  const EPS = 1e-6;
  const gap = Number(gapBeats) || 0;
  if (gap <= EPS) return staffNotes || [];
  let run = 0;
  const out = [];
  for (const n of staffNotes || []) {
    const s = typeof n.beat === 'number' ? n.beat : run;
    const dur = Number(n.duration) || 1;
    run = s + dur;
    if (s >= atBeat - EPS) {
      out.push({ ...n, beat: s + gap });
    } else {
      out.push(typeof n.beat === 'number' ? n : { ...n, beat: s });
    }
  }
  return out;
}

export function insertBeatGapIntoChords(chordList, atBeat, gapBeats) {
  const EPS = 1e-6;
  const gap = Number(gapBeats) || 0;
  if (gap <= EPS) return chordList || [];
  return (chordList || []).map((c) => {
    const p = Number(c.beatPosition) || 0;
    if (p >= atBeat - EPS) return { ...c, beatPosition: p + gap };
    return c;
  });
}
