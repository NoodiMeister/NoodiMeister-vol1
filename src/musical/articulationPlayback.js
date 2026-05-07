/**
 * MuseScore vaikimisi „gate time“ (instruments.xml) — helipikkus % kirjeldatud kestusest.
 * Viide: Music Stack Exchange → MuseScore instruments.xml.
 */

/** @type {Readonly<Record<string, number>>} percent 0–100 */
export const MUSESCORE_DEFAULT_GATE_TIME_PERCENT = Object.freeze({
  none: 100,
  /** Détaché = tenuto: täis kestus märkideta. */
  tenuto: 100,
  detache: 100,
  accent: 100,
  sforzato: 100,
  staccatissimo: 33,
  staccato: 50,
  portato: 67,
  marcato: 67,
  marcatoStaccato: 50,
  marcatoTenuto: 100,
  legato: 100,
});

/**
 * @param {string|null|undefined} articulation – note.articulation
 * @returns {number} 0.05–1
 */
export function getArticulationGateRatio(articulation) {
  if (articulation == null || articulation === '' || articulation === 'none') {
    return MUSESCORE_DEFAULT_GATE_TIME_PERCENT.none / 100;
  }
  const p = MUSESCORE_DEFAULT_GATE_TIME_PERCENT[articulation];
  if (p == null) return 1;
  return Math.max(0.05, Math.min(1, p / 100));
}
