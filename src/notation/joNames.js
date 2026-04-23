/**
 * JO-LE-MI süsteemi noodinimed vastavalt kasutaja sisendile:
 * JO, LE, MI, NA, SO, RA, DI
 */

import { getStaffPositionTreble, getTonicStaffPosition } from './StaffConstants';

// Defineerime 7 unikaalset astet (8. aste ehk oktaav on jälle 'JO')
const JO_NAMES = ['JO', 'LE', 'MI', 'NA', 'SO', 'RA', 'DI'];

function normalizeDegree(value) {
  return ((value % 7) + 7) % 7;
}

/**
 * Diatooniline aste JO-ankrust lähtuvalt.
 * 0 = JO, 1 = LE, ..., 6 = DI.
 */
function getDiatonicDegreeFromAnchor(pitch, octave, joAnchorStaffPosition) {
  const noteStaffPosition = getStaffPositionTreble(pitch, octave);
  return normalizeDegree(noteStaffPosition - joAnchorStaffPosition);
}

function resolveJoAnchorStaffPosition(keySignature = 'C', joStaffPosition) {
  if (typeof joStaffPosition === 'number' && Number.isFinite(joStaffPosition)) {
    return Math.round(joStaffPosition);
  }
  return getTonicStaffPosition(keySignature);
}

/**
 * Tagastab noodi nime (JO, LE, MI, NA, SO, RA, DI) JO-ankru järgi.
 *
 * Vaikimisi on JO-ankur helistikust (`keySignature`) tuletatud.
 * Kui JO-võti on käsitsi nihutatud, anna `joStaffPosition`.
 */
export function getJoName(pitch, octave, keySignature = 'C', joStaffPosition) {
  const joAnchor = resolveJoAnchorStaffPosition(keySignature, joStaffPosition);
  const degree = getDiatonicDegreeFromAnchor(pitch, octave, joAnchor);
  return JO_NAMES[degree] ?? 'JO';
}

export default getJoName;
