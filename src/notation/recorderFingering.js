/**
 * Soprano C plokkflööt — Saksa sõrmestus (SVG-augudiagramm).
 * Üks tõde: TraditionalNotationView + eelvaatekaart.
 *
 * Oktaavid (teaduslik / MIDI): madalaim noot = C4 (mitte C5).
 * Pöial eraldi; 7 sõrmeauku ülevalt alla (LH1–3, RH4–7).
 * true/1 = kinni, false/0 = lahti, 'half' = poolenisti.
 * D5+: sama sõrmestus mis oktav all, pöial täielikult kinni; "+" = ülemine register.
 * C♯: Yubioto (Saksa = barokk C♯ osas).
 */

/** Sõrmeaugud ülevalt alla. C5 = kõik lahti (eraldi harus). */
export const RECORDER_FINGER_HOLES = {
  C: [1, 1, 1, 1, 1, 1, 1],
  D: [1, 1, 1, 1, 1, 1, 0],
  E: [1, 1, 1, 1, 1, 0, 0],
  F: [1, 1, 1, 1, 0, 0, 0],
  'F#': [1, 1, 1, 1, 0, 1, 0],
  G: [1, 1, 1, 0, 0, 0, 0],
  'G#': [1, 1, 0, 1, 1, 0, 0],
  A: [1, 1, 0, 0, 0, 0, 0],
  'A#': [1, 0, 1, 1, 0, 0, 0],
  B: [1, 0, 0, 0, 0, 0, 0],
};

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
  const mid = low + 1; // 5 — C5 kõik lahti / C#5 eraldi
  const high = low + 2; // 6 — C6

  if (normalized === 'C' && !String(pitch).includes('#')) {
    if (octave === low) {
      return { thumb: true, holes: recorderHolesFromBits(RECORDER_FINGER_HOLES.C), overblow: false };
    }
    // C5 / C6: pöial lahti, kõik sõrmeaugud lahti
    if (octave === mid || octave === high) {
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
  // D5+ (ülemine register): pöial täielikult kinni — "+" näitab registrit
  if (octave >= mid) return { thumb: true, holes, overblow: true };
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
