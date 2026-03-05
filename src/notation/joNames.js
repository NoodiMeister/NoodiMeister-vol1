/**
 * JO-LE-MI (Kodály) noodinimed: toonikast lähtuva diatoonilise astme järgi.
 * JO = I, LE = II, MI = III, FA = IV, SOL = V, LA = VI, SI = VII.
 */

import { getRelativeHalfStepsFromTonic } from './StaffConstants';

const JO_NAMES = ['JO', 'LE', 'MI', 'FA', 'SOL', 'LA', 'SI'];

/**
 * Diatoniline aste C-duuri skaalas (0=C, 1=D, ..., 6=B).
 * Võtab arvesse helistiku: toonika määrab, milline täht on 0. aste.
 */
function getDiatonicDegree(pitch, octave, keySignature = 'C') {
  const halfSteps = getRelativeHalfStepsFromTonic(pitch, octave, keySignature);
  const mod = ((halfSteps % 12) + 12) % 12;
  const diatonicFromC = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
  const degree = diatonicFromC[mod];
  return degree != null ? degree : 0;
}

/**
 * Tagastab noodi JO-süsteemi nime (JO, LE, MI, FA, SOL, LA, SI) helistiku järgi.
 */
export function getJoName(pitch, octave, keySignature = 'C') {
  const degree = getDiatonicDegree(pitch, octave, keySignature);
  return JO_NAMES[degree] ?? 'JO';
}

export default getJoName;
