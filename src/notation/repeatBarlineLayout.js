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

/**
 * SMuFL kordus-taktijoon (E040–E042): fontSize ja Y peavad järgima **sama**
 * vertikaalulatust mis `<line y1 y2>` taktijoonel — muidu märk “hõljub”.
 *
 * @param {object} opts
 * @param {number} opts.barTopY – ülemine Y (px, SVG)
 * @param {number} opts.barBottomY – alumine Y (px)
 * @returns {{ y: number, fontSize: number, dominantBaseline: 'central' }}
 */
export function getRepeatBarlineSmuflPlacement({ barTopY, barBottomY }) {
  const top = Number(barTopY);
  const bottom = Number(barBottomY);
  const span = Math.max(1, bottom - top);
  const fontSize = Math.max(MIN_REPEAT_SMUFL_FONT_PX, span);
  return {
    y: top + span / 2,
    fontSize,
    dominantBaseline: 'central',
  };
}
