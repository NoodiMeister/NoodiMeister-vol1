import {
  getThinBarlineThickness,
  getThickBarlineThickness,
  BARLINE_SEPARATION,
} from './musescoreStyle';

/**
 * Traditsioonilise noodikirja lõpujoon (õhuke + paks): keskpunktid X-is.
 * Paks joon keskendub takti paremale servale (rightEdgeX) — sama reegel mis
 * `TraditionalNotationView` / MuseScore-stiilis thinThick.
 *
 * @param {number} rightEdgeX – takti parem serv (px)
 * @param {number} staffSpace – staff-space (px)
 */
export function getFinalDoubleBarlineCentersX(rightEdgeX, staffSpace) {
  const thinW = getThinBarlineThickness(staffSpace);
  const thickW = getThickBarlineThickness(staffSpace);
  const gap = BARLINE_SEPARATION * staffSpace;
  const thickCx = rightEdgeX;
  const thinCx = thickCx - (thickW / 2 + gap + thinW / 2);
  return { thinCx, thickCx, thinW, thickW };
}

const MIN_REPEAT_SMUFL_FONT_PX = 10;
const REPEAT_SMUFL_HEIGHT_MULTIPLIER = 1.18;

/**
 * SMuFL kordus-taktijoon (E040–E042): fontSize ja Y peavad järgima **sama**
 * vertikaalulatust mis `<line y1 y2>` taktijoonel — muidu märk “hõljub”.
 *
 * @param {object} opts
 * @param {number} opts.barTopY – ülemine Y (px, SVG)
 * @param {number} opts.barBottomY – alumine Y (px)
 * @param {number} [opts.staffSpace] – staff-space (px); kui puudu, hinnatakse span/4 (5-liiniline tava)
 * @returns {{ y: number, fontSize: number, dominantBaseline: 'middle' }}
 */
export function getRepeatBarlineSmuflPlacement({ barTopY, barBottomY, staffSpace }) {
  const top = Number(barTopY);
  const bottom = Number(barBottomY);
  const span = Math.max(1, bottom - top);
  void staffSpace;
  /**
   * Leland repeat glyphide (E040–E042) em-box sisaldab vertikaalseid
   * sisemarginaale. Kui võtta fontSize=span, jääb märk visuaalselt "hõljuma".
   * Tõstame mõõtu mõõdukalt, kuid hoiame keskpunkti geomeetriliselt samas.
   */
  const fontSize = Math.max(
    MIN_REPEAT_SMUFL_FONT_PX,
    span * REPEAT_SMUFL_HEIGHT_MULTIPLIER,
  );
  return {
    y: top + span / 2,
    fontSize,
    dominantBaseline: 'middle',
  };
}
