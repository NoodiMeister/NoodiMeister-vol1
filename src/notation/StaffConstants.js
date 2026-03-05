/**
 * Noodijoonestiku visuaalne notatsioon – kõik mõõdud sõltuvad ühest staff-space'ist.
 * Staff-space = vahe kahe joone vahel. Üks "samm" (pool space'i) = üks pooltoon.
 */

/** Standardne vahe kahe joone vahel (px). Kõik joonestiku mõõdud tuletatakse sellest. */
export const STAFF_SPACE = 10;

/** Pool staff-space'i = üks vertikaalne samm (noot joonel või vahes). */
export const HALF_SPACE = STAFF_SPACE / 2;

/** Noodipea raadius X (ovaal laius) = staffSpace * 0.7 */
export function getNoteheadRx(staffSpace = STAFF_SPACE) {
  return staffSpace * 0.7;
}

/** Noodipea raadius Y (ovaal kõrgus) = staffSpace * 0.5 */
export function getNoteheadRy(staffSpace = STAFF_SPACE) {
  return staffSpace * 0.5;
}

/** Abijoonte poollaius (X-suunas) = staffSpace * 1.4 */
export function getLedgerHalfWidth(staffSpace = STAFF_SPACE) {
  return staffSpace * 1.4;
}

/** Varre pikkus (noodipea keskpunktist otsani) ≈ 3,5 staff-space'i (standard). */
export function getStemLength(staffSpace = STAFF_SPACE) {
  return staffSpace * 3.5;
}

/** Lipu kõrgus (üks lipp) ≈ 1 staff-space. */
export function getFlagHeight(staffSpace = STAFF_SPACE) {
  return staffSpace * 1;
}

/** Lipu laius (horisontaalne ulatus) ≈ 0.8 staff-space. */
export function getFlagWidth(staffSpace = STAFF_SPACE) {
  return staffSpace * 0.8;
}

/**
 * Tagastab 5-joonelise joonestiku joonte Y-koordinaadid (ülalt alla).
 * centerY = joonestiku vertikaalne keskpunkt (timeline kõrguse/2).
 * Joon 0 = ülemine, joon 4 = alumine.
 */
export function getStaffLinePositions(centerY, staffLines = 5, staffSpace = STAFF_SPACE) {
  if (staffLines === 1) return [centerY];
  if (staffLines === 5) {
    const startY = centerY - 2 * staffSpace;
    return Array.from({ length: 5 }, (_, i) => startY + i * staffSpace);
  }
  return [centerY];
}

/**
 * Arvutab noodi Y-koordinaadi joonestiku "positsiooni" järgi.
 * position = poolspace sammud alt (0 = alumine joon, 1 = esimene vahe, 2 = teine joon, ... 8 = ülemine joon).
 * Viiulivõtmes: 0=E, 1=F, 2=G, 3=A, 4=B, 5=C5, 6=D5, 7=E5, 8=F5.
 */
export function getYFromStaffPosition(position, centerY, staffLines = 5, staffSpace = STAFF_SPACE) {
  const lines = getStaffLinePositions(centerY, staffLines, staffSpace);
  const bottomLineY = lines[lines.length - 1];
  const half = staffSpace / 2;
  return bottomLineY - position * half;
}

/**
 * Nootide tähed → indeks C-st (0–6).
 */
const PITCH_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/** Helistiku toonika (JO) viiulivõtme staff-positsioon (poolspace sammud, E4=0). Bb/Eb = bemoll. */
const TONIC_STAFF_POSITION = { C: -2, G: 2, D: 4, A: 5, E: 7, B: 9, F: 3, Bb: 8, Eb: 6 };

/**
 * Tagastab toonika (JO) staff-positsiooni viiulivõtme skaalas (0 = alumine joon E4, negatiivne = abijooned all).
 * Kasutatakse JO-võtme vaikimisi asukoha ja ankurina.
 */
export function getTonicStaffPosition(keySignature = 'C') {
  return TONIC_STAFF_POSITION[keySignature] ?? TONIC_STAFF_POSITION.C;
}

/** Staff-positsioon → helistik (JO-võtme liigutamise tulemus). */
export function getKeyFromStaffPosition(position) {
  const pos = Number(position);
  const entry = Object.entries(TONIC_STAFF_POSITION).find(([, p]) => p === pos);
  return entry ? entry[0] : 'C';
}

/**
 * Noodi staff-positsioon viiulivõtme skaalas (poolspace sammud, E4=0).
 */
export function getStaffPositionTreble(pitch, octave) {
  const rel = PITCH_INDEX[pitch] ?? 0;
  return (octave - 4) * 7 + rel - 2;
}

/**
 * Relatiivne pooltoonide arv toonikast (JO). Positiivne = kõrgem kui JO.
 * noteY = joKeyY - relativeHalfSteps * half (kõrgem heli = väiksem Y).
 */
export function getRelativeHalfStepsFromTonic(pitch, octave, keySignature = 'C') {
  const notePos = getStaffPositionTreble(pitch, octave);
  const tonicPos = getTonicStaffPosition(keySignature);
  return notePos - tonicPos;
}

/**
 * JO-võtme ankur: noteY = joKeyY + relativeIntervalOffset (offset = -relativeHalfSteps * half).
 * Kõik noodi Y-koordinaadid arvutatakse sellest valemist.
 */
export function getVerticalPositionFromJoAnchor(joKeyY, pitch, octave, keySignature = 'C', staffSpace = STAFF_SPACE) {
  const half = staffSpace / 2;
  const relativeHalfSteps = getRelativeHalfStepsFromTonic(pitch, octave, keySignature);
  return joKeyY - relativeHalfSteps * half;
}

const PITCH_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * Klõpsu Y → (pitch, octave) JO-režiimis: joKeyY on ankur, keySignature määrab toonika.
 */
export function getPitchFromJoClick(clickY, joKeyY, keySignature = 'C', staffSpace = STAFF_SPACE) {
  const half = staffSpace / 2;
  const relativeHalfSteps = Math.round((joKeyY - clickY) / half);
  const tonicPos = getTonicStaffPosition(keySignature);
  const notePos = tonicPos + relativeHalfSteps;
  const div = notePos + 2;
  const octave = 4 + Math.floor(div / 7);
  const r = ((div % 7) + 7) % 7;
  const pitch = PITCH_NAMES[r] ?? 'C';
  return { pitch, octave };
}

/**
 * Arvutab noodi täpse Y-koordinaadi joonestikul (relatiivne centerY kontekstis).
 * Viiulivõti: G4 on teisel joonel (ülalt); JO-võti: DO asub helistiku järgi (nt esimeses vahes).
 *
 * @param {string} pitch - Noot tähega (C, D, E, F, G, A, B)
 * @param {number} octave - Oktav (3, 4, 5, ...)
 * @param {string} clefType - 'treble' | 'bass' | 'jo'
 * @param {object} options
 * @param {number} options.centerY - Joonestiku keskpunkt Y
 * @param {number} [options.staffSpace] - Staff-space (vaikimisi STAFF_SPACE)
 * @param {string} [options.keySignature] - Helistik JO-võtme jaoks (C, G, D, F, Bb, ...)
 * @returns {number} Y-koordinaat (noodipea keskpunkt)
 */
export function getVerticalPosition(pitch, octave, clefType, options = {}) {
  const { centerY, staffSpace = STAFF_SPACE, keySignature = 'C' } = options;
  const half = staffSpace / 2;
  const lines = getStaffLinePositions(centerY, 5, staffSpace);
  const bottomLineY = lines[4];
  const firstLineY = lines[0];
  const lastLineY = lines[4];

  // Staff-indeks alt (0 = alumine joon E4 viiulivõtmes): iga samm = half
  const rel = PITCH_INDEX[pitch] ?? 0;

  if (clefType === 'treble') {
    // Viiulivõti: E4 = alumine joon → indeks 0, F4=1, G4=2, ...
    const index = (octave - 4) * 7 + rel - 2;
    return bottomLineY - index * half;
  }

  if (clefType === 'bass') {
    // Bassivõti: G2 = alumine joon, B2 teine joon, D3 kolmas, F3 neljas, A3 ülemine.
    const index = (octave - 2) * 7 + rel - 4;
    return bottomLineY - index * half;
  }

  if (clefType === 'jo' || clefType === 'do') {
    // JO-võti: DO on helistiku toonika. Sama skaala kui viiulivõti (E4 alumine joon).
    const index = (octave - 4) * 7 + rel - 2;
    return bottomLineY - index * half;
  }

  return centerY;
}

/**
 * Abijoonte arv üleval ja all, kui noot on väljas joonestikust.
 * pitchY = getVerticalPosition(...), firstLineY = ülemine joon, lastLineY = alumine joon.
 */
export function getLedgerLineCount(pitchY, firstLineY, lastLineY, staffSpace = STAFF_SPACE) {
  let above = 0;
  let below = 0;
  if (pitchY < firstLineY) {
    const diff = firstLineY - pitchY;
    above = Math.round(diff / staffSpace);
    if (above > 0 && Math.abs(diff - above * staffSpace) > staffSpace / 2) above = Math.ceil(diff / staffSpace);
  }
  if (pitchY > lastLineY) {
    const diff = pitchY - lastLineY;
    below = Math.round(diff / staffSpace);
    if (below > 0 && Math.abs(diff - below * staffSpace) > staffSpace / 2) below = Math.ceil(diff / staffSpace);
  }
  return { above, below };
}

/**
 * Abijooned vastavalt joon/vahe reeglile: noot võib olla JOONEL või VAHES.
 * Üleval: esimene vahe (A5) = 0 abijoont, esimene abijoon (B5) = 1 abijoon, jne.
 * All: esimene vahe (D4) = 0 abijoont, esimene abijoon (C4) = 1 abijoon, B3 = 1 abijoon (esimese abijoone all),
 *      A3 teisel abijoonel = 2 abijoont, G3 teise abijoone all = 2 abijoont.
 * Positsioon arvutatakse poolspace sammudes (0 = joon, 1 = vahe, 2 = joon, ...).
 */
export function getLedgerLineCountExact(pitchY, firstLineY, lastLineY, staffSpace = STAFF_SPACE) {
  const half = staffSpace / 2;
  let above = 0;
  let below = 0;
  if (pitchY < firstLineY) {
    const stepsAbove = Math.round((firstLineY - pitchY) / half);
    above = stepsAbove <= 0 ? 0 : Math.floor(stepsAbove / 2);
  }
  if (pitchY > lastLineY) {
    const stepsBelow = Math.round((pitchY - lastLineY) / half);
    below = stepsBelow <= 0 ? 0 : Math.floor(stepsBelow / 2);
  }
  return { above, below };
}
