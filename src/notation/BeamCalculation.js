/**
 * Noodivarte ühendamise (beaming) arvutused traditsioonilise notatsiooni jaoks.
 * Grupeerib 1/8 ja 1/16 nootid, arvutab tala asukoha ja varre pikkused.
 */

import { getStemLength, getBeamThickness, getBeamGap } from './StaffConstants';

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

  // In this codebase, `beat` is already in the time signature's beat-unit steps.
  // Example: 6/8 => beats=6 and beat indexes are eighth-note slots.
  const groupSize =
    beatUnit === 8 && beats % 3 === 0 && beats > 3
      ? 3
      : 1;

  const groups = [];
  let i = 0;
  while (i < notes.length) {
    const note = notes[i];
    if (note.isRest || !isBeamableDuration(note.durationLabel)) {
      i++;
      continue;
    }
    const group0 = Math.floor((note.beat - measureStartBeat) / groupSize);
    let j = i;
    while (j < notes.length) {
      const n = notes[j];
      if (n.isRest || !isBeamableDuration(n.durationLabel)) break;
      if (Math.floor((n.beat - measureStartBeat) / groupSize) !== group0) break;
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
 * keskmiste nootide varred ulatuvad täpselt talani.
 * @param {object} group - { start, end } indeksid notes massiivis
 * @param {Array<{ durationLabel: string, isDotted?: boolean }>} notes - rühma nootid (või kogu takti nootid, siis group.start..end)
 * @param {number[]} noteX - iga noodi X (pikslites)
 * @param {number[]} noteCy - iga noodi noodipea Y (pikslites, sama konteksti jaoks)
 * @param {boolean} stemUp - vars üles
 * @param {number} staffSpace
 * @returns {{ beamY1: number, beamY2: number, stemLengths: number[], numBeams: number, beamLevels: number[], xLeft: number, xRight: number }}
 */
export function computeBeamGeometry(group, notes, noteX, noteCy, stemUp, staffSpace) {
  const start = group.start;
  const end = group.end;
  const defaultStemLen = getStemLength(staffSpace);
  const xLeft = noteX[start];
  const xRight = noteX[end];
  const cy1 = noteCy[start];
  const cy2 = noteCy[end];

  const tipY = (cy, len) => (stemUp ? cy - len : cy + len);
  const beamTip1 = tipY(cy1, defaultStemLen);
  const beamTip2 = tipY(cy2, defaultStemLen);

  const dx = xRight - xLeft;
  const slope = dx !== 0 ? (beamTip2 - beamTip1) / dx : 0;

  const stemLengths = [];
  for (let k = start; k <= end; k++) {
    const x = noteX[k];
    const cy = noteCy[k];
    const beamYAtX = dx === 0 ? beamTip1 : beamTip1 + slope * (x - xLeft);
    const len = Math.abs(beamYAtX - cy);
    stemLengths.push(len);
  }

  let numBeams = 1;
  const beamLevels = [];
  for (let k = start; k <= end; k++) {
    const level = getBeamLevel(notes[k].durationLabel, notes[k].isDotted);
    beamLevels.push(level);
    if (level > numBeams) numBeams = level;
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
