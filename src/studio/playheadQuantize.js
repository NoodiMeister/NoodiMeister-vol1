/**
 * Playhead quantize = rütmivõre tihedus.
 *
 * Kui partituuris on 1/16 noodid, aga quantize = 1/8:
 *   playhead hüppab ainult iga 1/8 peale (üle ühe 1/16).
 * Kui quantize = 1/4:
 *   playhead jääb paigale (ootab) kuni järgmise 1/4 ruudustiku hetkeni, siis hüppab.
 *
 * Snap = floor (hold until next grid), mitte round.
 *
 * Pedagoogika: peenemad võred (1/8, 1/16, …) aitavad kooliõpilastel tajuda
 * kiiremate vältuste rütmi — hüpped teevad pulsatsiooni nähtavaks.
 */

import { durationLabelToQuarterNoteUnits } from '../musical/timeSignature.js';

/** Kasutaja valik Cursor paneelis (veerandnoodi ühikud). */
export const PLAYHEAD_QUANTIZE_GRIDS = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32'];

const LEGACY_UNIT_MAP = {
  beat: '1/4',
  halfBeat: '1/8',
  measure: '1/1',
};

export function normalizeQuantizeGrid(unit) {
  if (PLAYHEAD_QUANTIZE_GRIDS.includes(unit)) return unit;
  if (LEGACY_UNIT_MAP[unit]) return LEGACY_UNIT_MAP[unit];
  return '1/4';
}

export function quantizeGridBeats(unit) {
  const label = normalizeQuantizeGrid(unit);
  const beats = durationLabelToQuarterNoteUnits(label, false);
  return Number.isFinite(beats) && beats > 0 ? beats : 1;
}

/**
 * Snapi pidev beat-positsioon võrele (floor = oota järgmise ruuduni).
 * @param {number} beatContinuous - veerandnoodi ühikutes alates loo algusest
 * @param {string} gridLabel - nt '1/8'
 */
export function snapBeatToQuantizeGrid(beatContinuous, gridLabel) {
  const beat = Number(beatContinuous);
  if (!Number.isFinite(beat) || beat < 0) return 0;
  const grid = quantizeGridBeats(gridLabel);
  // floor: jää paigale kuni järgmise võrehetkeni
  return Math.floor(beat / grid + 1e-9) * grid;
}

/**
 * Progress 0..1 → snappitud progress (kui quantize sees).
 * @param {number} progress01
 * @param {number} totalBeats - loo pikkus veerandnootides
 * @param {{ enabled?: boolean, unit?: string }|null} quantize
 */
export function quantizeProgress01(progress01, totalBeats, quantize) {
  if (!quantize?.enabled) return Math.max(0, Math.min(1, Number(progress01) || 0));
  const total = Math.max(0.001, Number(totalBeats) || 1);
  const p = Math.max(0, Math.min(1, Number(progress01) || 0));
  const beat = p * total;
  const snapped = snapBeatToQuantizeGrid(beat, quantize.unit);
  return Math.max(0, Math.min(1, snapped / total));
}

/** Hinda loo pikkust veerandnootides snapshotist või sync-punktidest. */
export function estimateTotalBeatsFromDoc(doc, beatsPerMeasure = 4) {
  const notes = doc?.score?.snapshot?.notes;
  if (Array.isArray(notes) && notes.length) {
    let maxEnd = 0;
    for (const n of notes) {
      const start = Number(n.beat) || 0;
      const dur = Number(n.duration) || 0;
      maxEnd = Math.max(maxEnd, start + dur);
    }
    if (maxEnd > 0) return maxEnd;
  }
  const points = doc?.sync?.points || [];
  if (points.length) {
    const maxM = Math.max(...points.map((p) => Number(p.measureIndex) || 0));
    const bpm = Number(beatsPerMeasure) > 0 ? Number(beatsPerMeasure) : 4;
    return (maxM + 1) * bpm;
  }
  return 16;
}
