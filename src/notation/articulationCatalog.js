/**
 * Artikulatsioon (SMuFL Leland) — noodipea tööriistakast ja render.
 * Glüüfivalik: https://w3c-cg.github.io/smufl/latest/tables/articulation.html
 */

/** Tööriistakasti ja nosises data: id salvestub note.articulation. */
export const NOTEHEAD_ARTICULATION_DEFS = [
  { id: 'staccatissimo', labelKey: 'articulation.staccatissimo', glyphAbove: '\uE4A6', glyphBelow: '\uE4A7' },
  { id: 'staccato', labelKey: 'articulation.staccato', glyphAbove: '\uE4A2', glyphBelow: '\uE4A3' },
  /** MuseScore „portato“ = louré (tenuto+staccato). */
  { id: 'portato', labelKey: 'articulation.portato', glyphAbove: '\uE4B2', glyphBelow: '\uE4B3' },
  { id: 'tenuto', labelKey: 'articulation.tenuto', glyphAbove: '\uE4A4', glyphBelow: '\uE4A5' },
  { id: 'accent', labelKey: 'articulation.accent', glyphAbove: '\uE4A0', glyphBelow: '\uE4A1' },
  { id: 'marcato', labelKey: 'articulation.marcato', glyphAbove: '\uE4AC', glyphBelow: '\uE4AD' },
  { id: 'marcatoStaccato', labelKey: 'articulation.marcatoStaccato', glyphAbove: '\uE4AE', glyphBelow: '\uE4AF' },
  { id: 'marcatoTenuto', labelKey: 'articulation.marcatoTenuto', glyphAbove: '\uE4BC', glyphBelow: '\uE4BD' },
];

const ARTIC_IDS = new Set(NOTEHEAD_ARTICULATION_DEFS.map((d) => d.id));

export function isKnownArticulationId(id) {
  return id != null && ARTIC_IDS.has(String(id));
}

/**
 * @param {string|null|undefined} articId
 * @param {boolean} stemUp
 * @returns {string|null}
 */
export function smuflArticulationGlyph(articId, stemUp) {
  if (!articId || !ARTIC_IDS.has(String(articId))) return null;
  const d = NOTEHEAD_ARTICULATION_DEFS.find((x) => x.id === articId);
  if (!d) return null;
  return stemUp ? d.glyphAbove : d.glyphBelow;
}
