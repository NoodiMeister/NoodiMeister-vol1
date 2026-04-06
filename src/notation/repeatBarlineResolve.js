import { SMUFL_GLYPH } from './smufl/glyphs';

/**
 * Kordus-taktijooned: ühine otsustus kõikide vaadete jaoks.
 * Leland / SMuFL: algus U+E040, lõpp U+E041, mõlemad ühel joonel (rea sees) U+E042.
 *
 * U+E042 kasutatakse ainult sama süsteemirea kahe naabertakti piiril (j > 0),
 * mitte rea murdumisel (eelmine rida lõpeb repeatEnd-iga, uus rida repeatStart-iga).
 */

/**
 * @param {object} opts
 * @param {number} opts.measureIndexInSystem – takti järjekoraindeks selles süsteemis (0 = rea esimene takt)
 * @param {object|null|undefined} opts.measure – takt (repeatStart jne)
 * @param {object|null|undefined} opts.prevMeasureInSystem – eelmine takt samal real või null
 * @returns {{ variant: 'none'|'barline'|'start'|'both', glyph?: string, textAnchor?: 'start'|'middle'|'end' }}
 */
export function getLeftBarlineRepeatRender({
  measureIndexInSystem,
  measure,
  prevMeasureInSystem,
}) {
  const internal = measureIndexInSystem > 0;
  const prevEnd = !!(prevMeasureInSystem && prevMeasureInSystem.repeatEnd);
  const start = !!(measure && measure.repeatStart);
  if (internal && prevEnd && start) {
    return {
      variant: 'both',
      glyph: SMUFL_GLYPH.repeatRightLeft,
      textAnchor: 'middle',
    };
  }
  if (start) {
    return {
      variant: 'start',
      glyph: SMUFL_GLYPH.repeatLeft,
      textAnchor: 'end',
    };
  }
  if (internal) return { variant: 'barline' };
  return { variant: 'none' };
}

/**
 * Kas joonistada U+E041 selle takti paremale servale.
 * Kui järgmine takt samal real on repeatStart, joonistatakse U+E042 järgmise takti vasakul — siin E041 ära kuva.
 */
export function shouldDrawRepeatEndGlyphOnRight(measure, nextMeasureInSystem) {
  return !!(measure && measure.repeatEnd)
    && !(nextMeasureInSystem && nextMeasureInSystem.repeatStart);
}
