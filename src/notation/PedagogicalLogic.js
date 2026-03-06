/**
 * Pedagoogilise notatsiooni loogika – TÄIELIKULT ERALDI figuurnotatsioonist.
 * Ei impordi utils/figurenotes ega FigureNotesLibrary.
 * JO-võti on ankur: värvid ja kujundid arvutatakse relatiivselt JO positsioonist (staff position).
 */

/** Noodinimed C–B (relatiivne astme number 0–6). */
const PITCH_STEP = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/** Pedagoogilise süsteemi värvid (JO = punane ruut; samad võtmed nagu Figuurnotatsioonil, aga arvutus JO suhtes). */
const PEDAGOGICAL_COLORS = {
  0: '#e53935', // C – punane (JO)
  1: '#8d6e63', // D – pruun
  2: '#f9a825', // E – kollane
  3: '#43a047', // F – roheline
  4: '#1e88e5', // G – sinine
  5: '#fb8c00', // A – oranž
  6: '#7b1fa2', // B – lilla
};

/** Kujund oktaavivahemiku järgi (relatiivne JO-st: 0 = sama oktaav kui JO). */
const SHAPE_BY_RELATIVE_OCTAVE = {
  0: 'square',       // JO oktaav = ruut
  1: 'circle',
  2: 'triangle',
  '-1': 'cross',
  '-2': 'none',
};
const SHAPE_ORDER = ['none', 'cross', 'square', 'circle', 'triangle', 'triangleDown'];

/**
 * Arvutab noodi relatiivse astme (0–6) JO-võtme suhtes.
 * @param {string} keySignature – helistik (C, G, D, … Bb, Eb)
 * @param {number} joStaffPosition – JO staff position (poolspace sammud alt)
 * @param {string} pitch – C, D, E, F, G, A, B
 * @param {number} octave – teaduslik oktaav
 * @returns {number} poolspace sammud JO-st (positiivne = kõrgem)
 */
export function getRelativeStaffStepsFromJo(keySignature, joStaffPosition, pitch, octave) {
  const step = PITCH_STEP[pitch] ?? 0;
  const midiOctave = octave + 1;
  const totalSemitones = midiOctave * 12 + (step * 2 - Math.floor(step * 2 / 7) * 2); // ligikaudne
  const pitchPosition = getStaffPositionFromPitchOctave(pitch, octave);
  return pitchPosition - joStaffPosition;
}

/**
 * Ligikaudne staff position (poolspace) antud pitch+octave jaoks (viiulivõtme skaala).
 */
function getStaffPositionFromPitchOctave(pitch, octave) {
  const step = PITCH_STEP[pitch] ?? 0;
  const octaveOffset = (octave - 4) * 7 * 2;
  const stepOffset = step * 2 - (pitch === 'C' || pitch === 'F' ? 0 : 1);
  return 6 + octaveOffset + stepOffset;
}

/**
 * Tagastab pedagoogilise värvi antud noodi jaoks (JO suhtes).
 * @param {string} keySignature
 * @param {number} joStaffPosition
 * @param {string} pitch
 * @param {number} octave
 * @returns {string} hex värv
 */
export function getPedagogicalColor(keySignature, joStaffPosition, pitch, octave) {
  const steps = getRelativeStaffStepsFromJo(keySignature, joStaffPosition, pitch, octave);
  const stepInOctave = ((Math.round(steps / 2) % 7) + 7) % 7;
  return PEDAGOGICAL_COLORS[stepInOctave] ?? PEDAGOGICAL_COLORS[0];
}

/**
 * Tagastab pedagoogilise kujundi (JO suhtes).
 * @param {string} keySignature
 * @param {number} joStaffPosition
 * @param {string} pitch
 * @param {number} octave
 * @returns {string} 'none' | 'cross' | 'square' | 'circle' | 'triangle' | 'triangleDown'
 */
export function getPedagogicalShape(keySignature, joStaffPosition, pitch, octave) {
  const steps = getRelativeStaffStepsFromJo(keySignature, joStaffPosition, pitch, octave);
  const halfOctaves = steps / 7;
  const relOct = Math.floor(halfOctaves);
  const shape = SHAPE_BY_RELATIVE_OCTAVE[relOct] ?? SHAPE_BY_RELATIVE_OCTAVE[0];
  if (relOct >= 2) return 'triangleDown';
  return shape;
}

/**
 * Tagastab { color, shape } pedagoogilise režiimi jaoks (klaviatuur, noodid).
 */
export function getPedagogicalSymbol(keySignature, joStaffPosition, pitch, octave) {
  return {
    color: getPedagogicalColor(keySignature, joStaffPosition, pitch, octave),
    shape: getPedagogicalShape(keySignature, joStaffPosition, pitch, octave),
  };
}
