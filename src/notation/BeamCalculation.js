/**
 * Noodivarte ühendamise (beaming) arvutused traditsioonilise notatsiooni jaoks.
 * Grupeerib 1/8 ja 1/16 nootid, arvutab tala asukoha ja varre pikkused.
 */

import { getStemLength, getBeamThickness, getBeamGap } from './StaffConstants.js';

/** Kas vältus on lühem kui 1/4 (kaheksandik, kuueteistkümnendik) – võib talutada. */
export function isBeamableDuration(durationLabel) {
  return ['1/8', '1/16', '1/32'].includes(durationLabel || '');
}

/** Noodi "talade arv" (1 = 1/8, 2 = 1/16, 3 = 1/32). Punktiga noot loetakse sama tasemeks. */
export function getBeamLevel(durationLabel, isDotted) {
  const d = durationLabel || '1/4';
  if (d === '1/32') return 3;
  if (d === '1/16') return 2;
  if (d === '1/8') return 1;
  return 0;
}

/**
 * Grupeerib takti nootid talarühmadesse.
 * Reegel (VexFlow-laadne): järjestikused beamable nootid ühes "beat group"-is kuuluvad ühte rühma.
 * - Simple meter (nt 4/4, 3/4): group size = 1 beat
 * - Compound meter (nt 6/8, 9/8, 12/8): group size = 3 beats (dotted quarter feel)
 * @param {Array<{durationLabel: string, isRest: boolean, beat: number}>} notes - takti nootid
 * @param {number} measureStartBeat - takti alguse beat
 * @param {{ beats: number, beatUnit: number }} timeSignature - taktimõõt (vaikimisi 2 või 4 nooti rühmas)
 * @returns {Array<{ start: number, end: number }>} rühmad (indeksid start..end)
 */
export function computeBeamGroups(notes, measureStartBeat, timeSignature = { beats: 4, beatUnit: 4 }) {
  const beats = timeSignature?.beats ?? 4;
  const beatUnit = timeSignature?.beatUnit ?? 4;
  // In this codebase, `beat` is in current time-signature beat-unit steps.
  // MuseScore-like defaults:
  // - 3/8, 6/8, 9/8, 12/8 => by 3 eighths
  // - 3/16, 6/16, 9/16, 12/16 => by 3 sixteenths
  // - 2/8, 4/8 => by 2 eighths
  // - fallback => by single beat.
  const getDefaultGroupSpans = () => {
    if (beatUnit === 8) {
      if (beats === 2 || beats === 4) return [2];
      if (beats === 3 || beats === 6 || beats === 9 || beats === 12) return [3];
    }
    if (beatUnit === 16) {
      if (beats === 2 || beats === 4) return [2];
      if (beats === 3 || beats === 6 || beats === 9 || beats === 12) return [3];
    }
    return [1];
  };
  const groupSpans = getDefaultGroupSpans();
  const groupCycle = groupSpans.reduce((s, n) => s + n, 0) || 1;
  const getGroupIndex = (beatValue) => {
    const rel = Math.max(0, beatValue - measureStartBeat);
    const localInCycle = rel % groupCycle;
    let edge = 0;
    for (let idx = 0; idx < groupSpans.length; idx++) {
      edge += groupSpans[idx];
      if (localInCycle < edge) {
        return Math.floor(rel / groupCycle) * groupSpans.length + idx;
      }
    }
    return Math.floor(rel / groupCycle) * groupSpans.length;
  };

  const groups = [];
  let i = 0;
  while (i < notes.length) {
    const note = notes[i];
    if (note.isRest || !isBeamableDuration(note.durationLabel)) {
      i++;
      continue;
    }
    const explicitBeamGroupId = note.beamGroupId ?? null;
    const group0 = getGroupIndex(note.beat);
    let j = i;
    while (j < notes.length) {
      const n = notes[j];
      if (n.isRest || !isBeamableDuration(n.durationLabel)) break;
      if (explicitBeamGroupId != null) {
        if ((n.beamGroupId ?? null) !== explicitBeamGroupId) break;
        j++;
        continue;
      }
      if ((n.beamGroupId ?? null) != null) break;
      if (getGroupIndex(n.beat) !== group0) break;
      j++;
    }
    if (j > i + 1) {
      groups.push({ start: i, end: j - 1 });
    }
    i = j;
  }
  return groups;
}

/**
 * Arvutab ühe talarühma geomeetria: tala otspunktid (Y) ja iga noodi varre pikkuse.
 * Tala on sirge (või kergelt kaldus) esimese ja viimase noodi varreotsi vahel;
 * iga noodi vars ulatub oma rütmatasemele vastavale tala jooneni (1/8 → esimene kiht, 1/16 → teine jne).
 * @param {object} group - { start, end } indeksid notes massiivis
 * @param {Array<{ durationLabel: string, isDotted?: boolean }>} notes - rühma nootid (või kogu takti nootid, siis group.start..end)
 * @param {number[]} noteX - iga noodi X (pikslites)
 * @param {number[]} noteCy - iga noodi noodipea Y (pikslites, sama konteksti jaoks)
 * @param {boolean} stemUp - vars üles
 * @param {number} staffSpace
 * @returns {{ beamY1: number, beamY2: number, stemLengths: number[], numBeams: number, beamLevels: number[], xLeft: number, xRight: number }}
 * Render paint order: draw beam indices numBeams-1 … 0 so the primary (b=0) line is on top;
 * partial higher-level beams sit underneath (Gould / classical engraving, matches public/beam-samples).
 */
export function computeBeamGeometry(group, notes, noteX, noteCy, stemUp, staffSpace) {
  const start = group.start;
  const end = group.end;
  const defaultStemLen = getStemLength(staffSpace);
  const usesGlobalIndexedArrays =
    Array.isArray(noteX) &&
    Array.isArray(noteCy) &&
    noteX.length > end &&
    noteCy.length > end;
  const localStartIndex = usesGlobalIndexedArrays ? start : 0;
  const localEndIndex = usesGlobalIndexedArrays ? end : (end - start);
  const xLeft = noteX[localStartIndex];
  const xRight = noteX[localEndIndex];
  const cy1 = noteCy[localStartIndex];
  const cy2 = noteCy[localEndIndex];

  const beamLevels = [];
  let numBeams = 1;
  for (let k = start; k <= end; k++) {
    const level = getBeamLevel(notes[k].durationLabel, notes[k].isDotted);
    beamLevels.push(level);
    if (level > numBeams) numBeams = level;
  }

  const tipY = (cy, len) => (stemUp ? cy - len : cy + len);
  const beamTip1 = tipY(cy1, defaultStemLen);
  const beamTip2 = tipY(cy2, defaultStemLen);

  const dx = xRight - xLeft;
  const slope = dx !== 0 ? (beamTip2 - beamTip1) / dx : 0;

  const beamThick = getBeamThickness(staffSpace);
  const beamGap = getBeamGap(staffSpace);
  const beamOffset = beamThick + beamGap;
  const dir = stemUp ? -1 : 1;

  const stemLengths = [];
  for (let k = start; k <= end; k++) {
    const arrayIndex = usesGlobalIndexedArrays ? k : (k - start);
    const x = noteX[arrayIndex];
    const cy = noteCy[arrayIndex];
    const beamYPrimary = dx === 0 ? beamTip1 : beamTip1 + slope * (x - xLeft);
    const level = beamLevels[k - start];
    const bTarget = Math.min(Math.max(1, level), numBeams) - 1;
    const beamYTarget = beamYPrimary + bTarget * beamOffset * dir;
    const len = stemUp ? cy - beamYTarget : beamYTarget - cy;
    stemLengths.push(Math.max(0, len));
  }

  return {
    beamY1: beamTip1,
    beamY2: beamTip2,
    stemLengths,
    numBeams,
    beamLevels,
    xLeft,
    xRight,
    stemUp,
  };
}

/** Re-export SMuFL beam thickness and spacing from StaffConstants. */
export { getBeamThickness, getBeamGap };
