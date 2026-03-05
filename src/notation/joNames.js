/**
 * JO-LE-MI süsteemi noodinimed vastavalt kasutaja sisendile:
 * JO, LE, MI, NA, SO, RA, DI
 */

import { getRelativeHalfStepsFromTonic } from './StaffConstants';

// Defineerime 7 unikaalset astet (8. aste ehk oktaav on jälle 'JO')
const JO_NAMES = ['JO', 'LE', 'MI', 'NA', 'SO', 'RA', 'DI'];

/**
 * Diatooniline aste helistikust lähtuvalt.
 * 0 = I aste (JO), 1 = II aste (LE), ..., 6 = VII aste (DI).
 */
function getDiatonicDegree(pitch, octave, keySignature = 'C') {
  const halfSteps = getRelativeHalfStepsFromTonic(pitch, octave, keySignature);

  // Normaliseerime pooltoonid oktaavi piires (0-11)
  const mod = ((halfSteps % 12) + 12) % 12;

  // Kaardistame pooltoonid diatoonilisteks astmeteks (duur-skaala loogika)
  // 0: JO (I), 2: LE (II), 4: MI (III), 5: NA (IV), 7: SO (V), 9: RA (VI), 11: DI (VII)
  const diatonicMap = {
    0: 0, // JO
    2: 1, // LE
    4: 2, // MI
    5: 3, // NA
    7: 4, // SO
    9: 5, // RA
    11: 6, // DI
  };

  const degree = diatonicMap[mod];

  // Kui on altereeritud noot (nt pooltoon, mida mapis pole),
  // tagastame lähima astme või vaikimisi 0
  return degree !== undefined ? degree : 0;
}

/**
 * Tagastab noodi nime (JO, LE, MI, NA, SO, RA, DI) helistiku järgi.
 */
export function getJoName(pitch, octave, keySignature = 'C') {
  const degree = getDiatonicDegree(pitch, octave, keySignature);
  return JO_NAMES[degree] ?? 'JO';
}

export default getJoName;
