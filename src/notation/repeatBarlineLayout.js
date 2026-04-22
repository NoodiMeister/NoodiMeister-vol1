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
const REPEAT_RIGHT_GLYPH_INSET_STAFF_SPACES = 0.62;

/**
 * Ühtne barline-frame nii joonele kui kordusglüüfile.
 * Kui x puudub, saab frame'i kasutada puhtalt vertikaalgeomeetriaks.
 */
export function getBarlineFrame({ barlineX, barTopY, barBottomY, staffSpace }) {
  const x = Number(barlineX);
  const top = Number(barTopY);
  const bottom = Number(barBottomY);
  const rawSpan = bottom - top;
  const span = Math.max(1, rawSpan);
  const inferredSp = span / 4;
  const sp = Number(staffSpace);
  const safeStaffSpace =
    Number.isFinite(sp) && sp > 0 ? sp : inferredSp;
  return {
    x: Number.isFinite(x) ? x : 0,
    topY: top,
    bottomY: bottom,
    span,
    centerY: top + span / 2,
    staffSpace: safeStaffSpace,
  };
}

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
export function getRepeatBarlineSmuflPlacement({ barTopY, barBottomY, staffSpace, frame }) {
  const f = frame || getBarlineFrame({ barTopY, barBottomY, staffSpace });
  /**
   * Leland repeat glyphide (E040–E042) em-box sisaldab vertikaalseid
   * sisemarginaale. Kui võtta fontSize=span, jääb märk visuaalselt "hõljuma".
   * Tõstame mõõtu mõõdukalt, kuid hoiame keskpunkti geomeetriliselt samas.
   */
  const fontSize = Math.max(
    MIN_REPEAT_SMUFL_FONT_PX,
    f.span * REPEAT_SMUFL_HEIGHT_MULTIPLIER,
  );
  return {
    y: f.centerY,
    fontSize,
    dominantBaseline: 'middle',
  };
}

/**
 * Parem kordusmärk (U+E041) vajab väikest vasak-nihet, et glüüfi "paks joon"
 * langeks visuaalselt takti parema piiriga kokku (muidu jääb mulje, et märk ujub servast väljas).
 */
export function getRepeatRightGlyphX({ barlineX, staffSpace }) {
  const f = getBarlineFrame({ barlineX, barTopY: 0, barBottomY: 4, staffSpace });
  return f.x - f.staffSpace * REPEAT_RIGHT_GLYPH_INSET_STAFF_SPACES;
}
