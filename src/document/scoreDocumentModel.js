/**
 * Score-lehe ühtne dokumendimudel (plokid), millest tuletatakse print/PDF/eelvaate sisu.
 * Ekraan renderdab sama andmetest (tiitel, autor, noodid, textBoxes); see fail seab ekspordi
 * kihtide järjekorra ja meta — mitte eraldi "salajast" HTML struktuuri.
 */

import { buildTextBoxesSvgMarkup } from '../export/textBoxSvg';

/** Kasutaja dokumendi ploki tüübid (üks leht, vertikaalne voog). */
export const SCORE_DOCUMENT_BLOCK = Object.freeze({
  /** Tiitel + autor (vektor-tekst, üks plokk) */
  header: 'header',
  /** Noodigraafika (Timeline SVG innerHTML) */
  notation: 'notation',
  /** Kasutaja tekstikastid (absoluutse xy-ga) */
  textBox: 'textBox',
});

/**
 * Plokkide järjekord ekspordi SVG-s (z kasvab: hiljem = ülepoole eelmist).
 * Põhineb scoreToSvg contentString järjekorral.
 */
export const EXPORT_CONTENT_BLOCK_ORDER = Object.freeze([
  SCORE_DOCUMENT_BLOCK.header,
  SCORE_DOCUMENT_BLOCK.notation,
  SCORE_DOCUMENT_BLOCK.textBox,
]);

/**
 * Meta regressioonide ja logide jaoks: millised plokid selle ekspordiga kaasas on.
 *
 * @param {{ songTitle?: string, author?: string, textBoxes?: unknown[] }} params
 * @returns {Array<{ type: string, id: string, z?: number, count?: number }>}
 */
export function describeScoreDocumentBlocksForExport ({ songTitle, author, textBoxes }) {
  const tb = Array.isArray(textBoxes) ? textBoxes : [];
  const blocks = [
    {
      type: SCORE_DOCUMENT_BLOCK.header,
      id: 'score-header',
      z: 1,
      hasTitle: Boolean(String(songTitle || '').trim()),
      hasAuthor: Boolean(String(author || '').trim()),
    },
    { type: SCORE_DOCUMENT_BLOCK.notation, id: 'score-notation', z: 2 },
  ];
  if (tb.length > 0) {
    blocks.push({
      type: SCORE_DOCUMENT_BLOCK.textBox,
      id: 'score-text-boxes',
      z: 3,
      count: tb.length,
    });
  }
  return blocks;
}

/**
 * Tekstikastide SVG märgend (sama koordinaadistik kui scoreContainer: x,y absoluutselt).
 *
 * @param {unknown[]} textBoxes
 * @param {{ defaultFontFamily?: string, defaultFill?: string }} options
 */
export function buildScoreTextBoxesExportMarkup (textBoxes, options = {}) {
  if (!Array.isArray(textBoxes) || textBoxes.length === 0) return '';
  return buildTextBoxesSvgMarkup(textBoxes, {
    defaultFontFamily: options.defaultFontFamily,
    defaultFill: options.defaultFill,
  });
}
