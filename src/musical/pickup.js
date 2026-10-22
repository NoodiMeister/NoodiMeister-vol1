/**
 * Eeltakt (pickup / anacrusis) ja poolik viimane takt.
 * Ajaühik = neljandik (sama skaala mis note.beat / note.duration).
 */
import {
  measureLengthInQuarterBeats,
  durationLabelToQuarterNoteUnits,
} from './timeSignature';

/**
 * Eeltakti pikkus neljandikühikutes (klambitud alla täistaktist).
 * @returns {number} 0 kui eeltakt välja
 */
export function getPickupQuarterBeats({
  enabled = false,
  quantity = 1,
  duration = '1/4',
  timeSignature,
} = {}) {
  if (!enabled || !(Number(quantity) > 0) || !duration) return 0;
  const measureQuarters = measureLengthInQuarterBeats(timeSignature);
  const raw = Number(quantity) * durationLabelToQuarterNoteUnits(duration);
  if (!(raw > 0) || !(measureQuarters > 0)) return 0;
  return Math.max(0.25, Math.min(raw, Math.max(0.25, measureQuarters - 0.25)));
}

/**
 * Viimase takti pikkus, kui “poolik viimane takt” on sees (eeltakti täiendus).
 * MuseScore/Sibelius tava: eeltakt + viimane takt = üks täistakt.
 */
export function getLastMeasureQuarterBeats({
  measureQuarters,
  pickupBeats = 0,
  incompleteLast = false,
  measureCount = 1,
} = {}) {
  const full = Number(measureQuarters) || 4;
  if (!incompleteLast || !(pickupBeats > 0) || measureCount < 2) return full;
  return Math.max(0.25, full - pickupBeats);
}

/**
 * Takti piirid (start/end/beatCount) eeltakti + valikulise pooliku lõputaktiga.
 */
export function getMeasureBoundsAtIndex(measureIndex, {
  measureQuarters,
  firstMeasureBeats,
  lastMeasureBeats,
  totalMeasures,
} = {}) {
  const full = Number(measureQuarters) || 4;
  const first = Number(firstMeasureBeats) > 0 ? Number(firstMeasureBeats) : full;
  const last = Number(lastMeasureBeats) > 0 ? Number(lastMeasureBeats) : full;
  const total = Math.max(1, Number(totalMeasures) || 1);
  const idx = Math.max(0, measureIndex | 0);

  if (idx === 0) {
    return { startBeat: 0, endBeat: first, beatCount: first };
  }
  if (idx === total - 1 && total >= 2) {
    const startBeat = first + (total - 2) * full;
    return { startBeat, endBeat: startBeat + last, beatCount: last };
  }
  const startBeat = first + (idx - 1) * full;
  return { startBeat, endBeat: startBeat + full, beatCount: full };
}

/**
 * Minimaalne taktide arv, et katta maxEndBeat (eeltakt + valikuline poolik lõpp).
 */
export function minMeasuresForEndBeat(maxEndBeat, {
  measureQuarters,
  pickupBeats = 0,
  incompleteLast = false,
} = {}) {
  const full = Number(measureQuarters) || 4;
  const first = pickupBeats > 0 ? pickupBeats : full;
  const end = Number(maxEndBeat) || 0;
  if (end <= 0) return 1;
  if (end <= first + 1e-9) return 1;

  if (incompleteLast && pickupBeats > 0) {
    // N >= 2: capacity = (N - 1) * full  (eeltakt + täistaktid + poolik lõpp)
    return Math.max(2, 1 + Math.ceil((end - 1e-9) / full));
  }

  const after = Math.ceil((end - first - 1e-9) / full);
  return 1 + Math.max(0, after);
}

/**
 * Nihuta noodid ajateljel (MuseScore: eeltakti lisamine ette = sisu nihkub edasi).
 * Negatiivsele nihkele minevad sündmused jäetakse välja.
 */
export function shiftNotesByBeats(notes, deltaBeats) {
  const delta = Number(deltaBeats) || 0;
  if (!delta || !Array.isArray(notes) || notes.length === 0) return notes || [];
  const EPS = 1e-9;
  let run = 0;
  const out = [];
  for (const n of notes) {
    const beat = typeof n?.beat === 'number' ? n.beat : run;
    const dur = Number(n?.duration) || 1;
    run = beat + dur;
    const next = beat + delta;
    if (next + dur <= EPS) continue;
    out.push({ ...n, beat: Math.max(0, next) });
  }
  return out;
}

export function shiftStavesByBeats(staves, deltaBeats) {
  const delta = Number(deltaBeats) || 0;
  if (!delta || !Array.isArray(staves)) return staves || [];
  return staves.map((staff) => ({
    ...staff,
    notes: shiftNotesByBeats(staff?.notes || [], delta),
  }));
}

export function shiftChordsByBeats(chords, deltaBeats) {
  const delta = Number(deltaBeats) || 0;
  if (!delta || !Array.isArray(chords)) return chords || [];
  const EPS = 1e-9;
  return chords
    .map((c) => {
      const p = Number(c?.beatPosition) || 0;
      const next = p + delta;
      if (next < -EPS) return null;
      return { ...c, beatPosition: Math.max(0, next) };
    })
    .filter(Boolean);
}

export function shiftIntermissionLabelsByBeats(labels, deltaBeats) {
  const delta = Number(deltaBeats) || 0;
  if (!delta || !Array.isArray(labels)) return labels || [];
  const EPS = 1e-9;
  return labels
    .map((lab) => {
      const start = (Number(lab?.startBeat) || 0) + delta;
      const end = (Number(lab?.endBeat) || 0) + delta;
      if (end <= EPS) return null;
      return {
        ...lab,
        startBeat: Math.max(0, start),
        endBeat: Math.max(Math.max(0, start), end),
      };
    })
    .filter(Boolean);
}

/**
 * Arvuta delta, kui eeltakti seaded muutuvad (insert/remove semantics).
 * Positiivne = sisu nihkub edasi (tühi eeltakt ette).
 */
export function pickupChangeDeltaBeats(prev, next, timeSignature) {
  const oldBeats = getPickupQuarterBeats({ ...prev, timeSignature });
  const newBeats = getPickupQuarterBeats({ ...next, timeSignature });
  return newBeats - oldBeats;
}
