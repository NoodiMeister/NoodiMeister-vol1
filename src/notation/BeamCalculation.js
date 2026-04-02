/**
 * Noodivarte ühendamise (beaming) arvutused traditsioonilise notatsiooni jaoks.
 * Grupeerib 1/8 ja 1/16 nootid, arvutab tala asukoha ja varre pikkused.
 */

import {
  getStemLength,
  getBeamThickness,
  getBeamGap,
  getStemThickness,
  getStemHorizontalOffsetFromNoteCenter,
  SMUFL_LELAND_NOTEHEAD_BLACK_WIDTH_SP,
} from './StaffConstants.js';

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
 * @param {{ noteheadWidthSp?: number }} [beamOptions] — SMuFL noteheadBlack bbox laius (sp); vaikimisi Leland 1.3 (Bravura nt 1.18 koondtabelis).
 * @returns {{ beamY1: number, beamY2: number, stemLengths: number[], numBeams: number, beamLevels: number[],
 *   xLeft: number, xRight: number, beamXLeft: number, beamXRight: number, stemXsInGroup: number[], stemW: number,
 *   beamSlope: number, mixedBeamStackSwap?: boolean }}
 * xLeft/xRight: esimese ja viimase noodi *varre keskjoone* X (slope ja varre pikkused).
 * beamXLeft/beamXRight: tala joone otspunktid varre *välimistel* servadel (SVG horisontaaljoone paksus ei lisa x-s).
 * Render paint order: draw beam indices numBeams-1 … 0 so the inner line is under, outer on top.
 * mixedBeamStackSwap (2 kihti + eri pikkused): Noodimeister / beam-1-8-plus-2-16 — esmane 1/8 tala
 * väljaspool (kaugemal noodist), sekundaarne osaline seespool (Gouldi vastupidine).
 */
export function computeBeamGeometry(group, notes, noteX, noteCy, stemUp, staffSpace, beamOptions = {}) {
  const start = group.start;
  const end = group.end;
  const defaultStemLen = getStemLength(staffSpace);
  const stemW = getStemThickness(staffSpace);
  const noteheadWidthSp = beamOptions.noteheadWidthSp ?? SMUFL_LELAND_NOTEHEAD_BLACK_WIDTH_SP;
  const stemOffset = getStemHorizontalOffsetFromNoteCenter(staffSpace, stemUp, { noteheadWidthSp });

  const usesGlobalIndexedArrays =
    Array.isArray(noteX) &&
    Array.isArray(noteCy) &&
    noteX.length > end &&
    noteCy.length > end;
  const localStartIndex = usesGlobalIndexedArrays ? start : 0;
  const localEndIndex = usesGlobalIndexedArrays ? end : end - start;
  const cy1 = noteCy[localStartIndex];
  const cy2 = noteCy[localEndIndex];

  const stemXsInGroup = [];
  for (let k = start; k <= end; k++) {
    const arrayIndex = usesGlobalIndexedArrays ? k : k - start;
    stemXsInGroup.push(noteX[arrayIndex] + stemOffset);
  }

  const xLeft = stemXsInGroup[0];
  const xRight = stemXsInGroup[stemXsInGroup.length - 1];
  const beamXLeft = xLeft - stemW / 2;
  const beamXRight = xRight + stemW / 2;

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
  const beamSlope = dx !== 0 ? (beamTip2 - beamTip1) / dx : 0;

  const beamThick = getBeamThickness(staffSpace);
  const beamGap = getBeamGap(staffSpace);
  const beamOffset = beamThick + beamGap;
  const dir = stemUp ? -1 : 1;

  const mixedBeamStackSwap = numBeams === 2 && new Set(beamLevels).size > 1;

  const stemLengths = [];
  for (let k = start; k <= end; k++) {
    const arrayIndex = usesGlobalIndexedArrays ? k : k - start;
    const xStem = stemXsInGroup[k - start];
    const cy = noteCy[arrayIndex];
    const beamYPrimary = dx === 0 ? beamTip1 : beamTip1 + beamSlope * (xStem - xLeft);
    const level = beamLevels[k - start];
    let beamYTarget;

    if (mixedBeamStackSwap && numBeams === 2) {
      /* Pika esmase tala keskjoon (välimine kiht); 1/8 ots keskel, 1/16 otsad tala alumisel serval (vt beam-samples). */
      const yOuterCenter = beamYPrimary + beamOffset * dir;
      if (level === 1) {
        beamYTarget = yOuterCenter;
      } else {
        const towardNotehead = stemUp ? 1 : -1;
        beamYTarget = yOuterCenter + (beamThick / 2) * towardNotehead;
      }
    } else if (numBeams === 2 && beamLevels.every((l) => l === 2)) {
      /* 4x1/16: kõik varred ülemise tala alumise serva juurde (sama reegel mis segarütmil 1/16 jaoks). */
      const yOuterCenter = beamYPrimary + beamOffset * dir;
      const towardNotehead = stemUp ? 1 : -1;
      beamYTarget = yOuterCenter + (beamThick / 2) * towardNotehead;
    } else {
      const bTarget = Math.min(Math.max(1, level), numBeams) - 1;
      beamYTarget = beamYPrimary + bTarget * beamOffset * dir;
    }

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
    beamXLeft,
    beamXRight,
    stemXsInGroup,
    stemW,
    beamSlope,
    mixedBeamStackSwap,
    stemUp,
  };
}

/** Tala joone Y antud X juures (beamSlope = (beamY2-beamY1)/(xRight-xLeft) varre keskjoontes). */
export function beamLineYAtX(beamY1, beamSlope, xStemLeft, x, dy = 0) {
  return beamY1 + dy + beamSlope * (x - xStemLeft);
}

/** Re-export SMuFL beam thickness and spacing from StaffConstants. */
export { getBeamThickness, getBeamGap };
