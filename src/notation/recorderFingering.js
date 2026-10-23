/**
 * Soprano C plokkflööt — Saksa sõrmestus (SVG-augudiagramm).
 * Üks tõde: TraditionalNotationView + eelvaatekaart.
 *
 * Oktaavid (teaduslik / MIDI): madalaim noot = C4.
 * Pöial eraldi; 7 sõrmeauku ülevalt alla (LH1–3, RH4–7).
 * true/1 = kinni, false/0 = lahti, 'half' = poolenisti (pool must / pool valge).
 * D5–B5: sama sõrmestus mis oktav 4, pöial half (mitte "+" märk).
 * F♯: I–III kinni, IV lahti, V–VI kinni, VII lahti.
 * C♯: Yubioto (Saksa = barokk C♯ osas).
 */

/** Sõrmeaugud ülevalt alla (LH1–3, RH4–7). */
export const RECORDER_FINGER_HOLES = {
  C: [1, 1, 1, 1, 1, 1, 1],
  D: [1, 1, 1, 1, 1, 1, 0],
  E: [1, 1, 1, 1, 1, 0, 0],
  F: [1, 1, 1, 1, 0, 0, 0],
  /** F♯4/F♯5: I–III kinni, IV lahti, V–VI kinni, VII lahti */
  'F#': [1, 1, 1, 0, 1, 1, 0],
  G: [1, 1, 1, 0, 0, 0, 0],
  'G#': [1, 1, 0, 1, 1, 0, 0],
  A: [1, 1, 0, 0, 0, 0, 0],
  'A#': [1, 0, 1, 1, 0, 0, 0],
  B: [1, 0, 0, 0, 0, 0, 0],
};

/** C5: pöial kinni, I lahti, II kinni, III–VII lahti. */
const RECORDER_C5_HOLES = [0, 1, 0, 0, 0, 0, 0];
const RECORDER_HOLES_ALL_OPEN = [0, 0, 0, 0, 0, 0, 0];

/** Madalaim kirjutatud / teaduslik oktav soprano C Saksa plokkflöödil. */
export const RECORDER_LOWEST_OCTAVE = 4;

function recorderHolesFromBits(bits) {
  if (!Array.isArray(bits) || bits.length !== 7) return null;
  return bits.map((v) => {
    if (v === 'half' || v === 0.5) return 'half';
    return v === 1 || v === true;
  });
}

/**
 * @param {string} pitch - nt C, C#, F#, Bb
 * @param {number} octave - teaduslik oktav (madal C = 4)
 * @returns {{ thumb: boolean|'half', holes: Array<boolean|'half'>, overblow: boolean }|null}
 */
export function getRecorderFingeringPattern(pitch, octave) {
  if (!pitch || typeof octave !== 'number' || octave < RECORDER_LOWEST_OCTAVE) return null;
  const sharpFromFlat = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
  const normalized = sharpFromFlat[pitch] || pitch;
  const low = RECORDER_LOWEST_OCTAVE; // 4
  const mid = low + 1; // 5
  const high = low + 2; // 6

  if (normalized === 'C' && !String(pitch).includes('#')) {
    if (octave === low) {
      return { thumb: true, holes: recorderHolesFromBits(RECORDER_FINGER_HOLES.C), overblow: false };
    }
    if (octave === mid) {
      return { thumb: true, holes: recorderHolesFromBits(RECORDER_C5_HOLES), overblow: false };
    }
    if (octave === high) {
      return { thumb: false, holes: recorderHolesFromBits(RECORDER_HOLES_ALL_OPEN), overblow: false };
    }
    return null;
  }

  if (normalized === 'C#') {
    if (octave === low) {
      return { thumb: true, holes: [true, true, true, true, true, true, 'half'], overblow: false };
    }
    if (octave === mid) {
      return { thumb: false, holes: [true, true, false, false, false, false, false], overblow: false };
    }
    return null;
  }

  const holes = recorderHolesFromBits(RECORDER_FINGER_HOLES[normalized]);
  if (!holes) return null;
  if (octave === low) return { thumb: true, holes, overblow: false };
  // D5–B5 (ja sama register kõrgemal): sama sõrmestus, pöial half — ilma "+" märgita
  if (octave >= mid) return { thumb: 'half', holes, overblow: false };
  return null;
}

/** Legacy 7-bit tabel (ilma pöidlata) — nt getFingeringForNote. */
export function buildRecorderFingerHolesTable() {
  const out = {};
  const pitches = ['C', 'C#', 'D', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (const oct of [4, 5, 6]) {
    for (const p of pitches) {
      if (oct === 6 && p !== 'C') continue;
      const pat = getRecorderFingeringPattern(p, oct);
      if (!pat) continue;
      const bits = pat.holes.map((h) => (h === 'half' ? 0.5 : h ? 1 : 0));
      out[`${p}${oct}`] = bits;
      if (p === 'A#') out[`Bb${oct}`] = bits;
      if (p === 'C#') out[`Db${oct}`] = bits;
    }
  }
  return out;
}
