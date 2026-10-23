/**
 * Paigutusmoodul: noodilehe laius/kõrgus, takti laiendamine/kokkusurumine ({ }),
 * ridade vertikaalne liigutamine. Ekspordib computeLayout, LAYOUT konstandid ja
 * getStaffHeight.
 */

import { getPaperDimensionsPx, getNotationPageBodies, snapSystemYToPage } from '../utils/pageGeometry';
import { measureLengthInQuarterBeats } from '../musical/timeSignature';
import { fitWidthsToContentWidth } from './pageFitSpacing';

const DEFAULT_PAGE_DIMS = getPaperDimensionsPx('a4', 'portrait');
const DEFAULT_PAGE_DIMS_LANDSCAPE = getPaperDimensionsPx('a4', 'landscape');
const DEFAULT_HEIGHT_RATIO = DEFAULT_PAGE_DIMS.height / DEFAULT_PAGE_DIMS.width;
const DEFAULT_HEIGHT_RATIO_LANDSCAPE = DEFAULT_PAGE_DIMS_LANDSCAPE.height / DEFAULT_PAGE_DIMS_LANDSCAPE.width;

/**
 * Noodileht (ScorePage): ala noodi sisestus programmis, kuhu kantakse noodiga seotud kujutised, tekstid ja lehe disainid.
 * Mõõtmed sõltuvad lehe suunast (orientation).
 */
export function getScorePageDimensions (orientation, paperSize = 'a4') {
  return getPaperDimensionsPx(paperSize, orientation);
}

export const LAYOUT = {
  /**
   * Peab klappima `index.css` → `.sheet-music-page { padding }`.
   * Paigutus kasutab sisemist sisu kasti (paber – padding), et portrait↔landscape ei murraks sisu vale kõrguse järgi.
   */
  SCORE_SHEET_PADDING_MM: 15,
  /**
   * Extra keep-out at the bottom of each page’s notation area (inside the padded sheet).
   * If the next staff would sit in this band, it goes to the next page.
   */
  PAGE_EDGE_RESERVE_MM: 16,
  /** Vertikaalne vahe ekraanil lehtede vahel (laua taust); peab klappima Timeline `physicalPageGapPx`. */
  SCORE_DESK_PAGE_GAP_PX: 36,
  /** Lehe laius/kõrgus px (96 DPI), vaikimisi A4 portrait. */
  PAGE_WIDTH_PX: DEFAULT_PAGE_DIMS.width,
  PAGE_HEIGHT_PX: DEFAULT_PAGE_DIMS.height,
  PAGE_WIDTH_MIN: DEFAULT_PAGE_DIMS.width,
  PAGE_WIDTH_MAX: DEFAULT_PAGE_DIMS.width,
  PAGE_WIDTH_MAX_LANDSCAPE: DEFAULT_PAGE_DIMS_LANDSCAPE.width,
  /** Portrait: kõrgus/laius = 297/210. Landscape: kõrgus/laius = 210/297. */
  A4_HEIGHT_RATIO: DEFAULT_HEIGHT_RATIO,
  A4_HEIGHT_RATIO_LANDSCAPE: DEFAULT_HEIGHT_RATIO_LANDSCAPE,
  /** A4 width/height in px at 96dpi (legacy names). */
  A4_WIDTH_PX_AT_96DPI: DEFAULT_PAGE_DIMS.width,
  A4_HEIGHT_PX_AT_96DPI: DEFAULT_PAGE_DIMS.height,
  SYSTEM_GAP: 120,
  MARGIN_LEFT: 60,
  MARGIN_RIGHT: 40,
  /** Left margin for traditional/pedagogical notation (clef + key + time sig). Used so measure widths fit within page. */
  CONTENT_LEFT_TRADITIONAL: 150,
  CLEF_WIDTH: 45,
  MEASURE_MIN_WIDTH: 28,
};

export const PAGE_BREAK_GAP = 80;

let GLOBAL_NOTATION_CONFIG = {
  STAFF_HEIGHT: 140,
  STAFF_SPACE: 10,
};
if (typeof window !== 'undefined' && window.NOODIMEISTER_CONFIG) {
  const c = window.NOODIMEISTER_CONFIG;
  if (c.STAFF_HEIGHT != null && c.STAFF_HEIGHT > 0) GLOBAL_NOTATION_CONFIG.STAFF_HEIGHT = c.STAFF_HEIGHT;
  if (c.STAFF_SPACE != null) GLOBAL_NOTATION_CONFIG.STAFF_SPACE = c.STAFF_SPACE;
}

export function getStaffHeight() {
  const h = GLOBAL_NOTATION_CONFIG.STAFF_HEIGHT;
  return (h != null && h > 0) ? h : 140;
}

export function setLayoutConfig(config) {
  if (config?.STAFF_HEIGHT != null) GLOBAL_NOTATION_CONFIG.STAFF_HEIGHT = config.STAFF_HEIGHT;
  if (config?.STAFF_SPACE != null) GLOBAL_NOTATION_CONFIG.STAFF_SPACE = config.STAFF_SPACE;
}

/**
 * Arvutab süsteemid (read) – iga rida = eraldi Stave.
 * Toetab eeltakti, taktide arv rea kohta, käsitsi rea/lehevahetusi ja measureStretchFactors ({ } klahvid).
 *
 * `pixelsPerBeat` + stretch on SOOVITUD tihedus (nagu figuurnotatsioonis): rida ei venita
 * vaikimisi lehe täislaiuseks. Üleääre korral skaleeritakse `fitWidthsToContentWidth`-iga.
 * See võimaldab ridade joondust (vasak/keskele/parem), kui rida on lehest kitsam.
 */
export function computeLayout(measures, timeSignature, pixelsPerBeat, pageWidth, layoutOptions = {}) {
  const w = Number(pageWidth) || LAYOUT.PAGE_WIDTH_MIN;
  const leftMargin = typeof layoutOptions.marginLeft === 'number' ? layoutOptions.marginLeft : LAYOUT.MARGIN_LEFT;
  const availableWidth = Math.max(200, w - leftMargin - LAYOUT.MARGIN_RIGHT);
  const beatsPerMeasure = measureLengthInQuarterBeats(timeSignature);
  const {
    measuresPerLine = 0,
    lineBreakBefore = [],
    pageBreakBefore = [],
    systemGap = LAYOUT.SYSTEM_GAP,
    staffCount = 1,
    measureStretchFactors = [],
    staffHeight: optionsStaffHeight,
    staffSpace: optionsStaffSpace,
    globalSpacingMultiplier = 1,
    staffSpacing: optionsStaffSpacing,
    pageHeight: optionsPageHeight,
    excludePickupFromMeasureCount = false,
    pickupMeasureIndex = 0,
    enforceMeasuresPerLine = true,
    notationPageHeaderReservePx = 0,
    notationPageEdgeReservePx = 0,
  } = layoutOptions;
  const mult = Math.max(0.25, Math.min(3, Number(globalSpacingMultiplier) || 1));
  const effectiveMeasuresPerLine = measuresPerLine > 0 ? Math.max(1, Math.round(measuresPerLine / mult)) : 0;
  const desiredPixelsPerBeat = Math.max(12, Number(pixelsPerBeat) || 85);
  const staffHeightForStep = optionsStaffHeight ?? getStaffHeight();
  const step = typeof optionsStaffSpacing === 'number' && optionsStaffSpacing > 0
    ? optionsStaffSpacing
    : (staffCount || 1) * staffHeightForStep + systemGap;
  const pageHeight = typeof optionsPageHeight === 'number' && optionsPageHeight > 0 ? optionsPageHeight : null;
  const { firstBody: firstPageBodyH, restBody: restPageH } = pageHeight != null
    ? getNotationPageBodies(pageHeight, notationPageHeaderReservePx)
    : { firstBody: 0, restBody: 0 };
  const placeSystemY = (proposedY, systemIndex, forcePageBreak) => snapSystemYToPage({
    proposedY,
    occupyHeight: step,
    firstBody: firstPageBodyH,
    restBody: restPageH,
    forcePageBreak: !!forcePageBreak && systemIndex > 0,
    isFirstSystem: systemIndex === 0,
    pageEdgeReservePx: notationPageEdgeReservePx,
  });
  const lineSet = new Set(Array.isArray(lineBreakBefore) ? lineBreakBefore : []);
  const pageSet = new Set(Array.isArray(pageBreakBefore) ? pageBreakBefore : []);
  const getFactor = (i) => (Array.isArray(measureStretchFactors) && typeof measureStretchFactors[i] === 'number')
    ? measureStretchFactors[i]
    : 1;
  const getMeasureBeats = (i) => measures[i].beatCount ?? beatsPerMeasure;
  const getNaturalMeasureWidth = (i) => getMeasureBeats(i) * desiredPixelsPerBeat * getFactor(i);
  const getMeasureCountWeight = (i) => {
    if (measures[i]?.excludeFromCount === true) return 0;
    if (measures[i]?.excludeFromCount === false) return 1;
    return (excludePickupFromMeasureCount && i === pickupMeasureIndex ? 0 : 1);
  };

  const buildSystem = (rowIndices, systemIndex, nextPageBreak) => {
    if (rowIndices.length === 0) return null;
    const naturalWidths = rowIndices.map((i) => getNaturalMeasureWidth(i));
    const totalNatural = naturalWidths.reduce((a, b) => a + b, 0);
    if (!(totalNatural > 0)) return null;
    const measureWidths = fitWidthsToContentWidth(naturalWidths, availableWidth);
    const rowWidth = measureWidths.reduce((a, b) => a + b, 0);
    const totalBeatCount = rowIndices.reduce((sum, i) => sum + getMeasureBeats(i), 0);
    const pixelsPerBeatForRow = totalBeatCount > 0 ? rowWidth / totalBeatCount : desiredPixelsPerBeat;
    return {
      systemIndex,
      measureIndices: rowIndices,
      measureWidths,
      yOffset: 0,
      pixelsPerBeat: pixelsPerBeatForRow,
      measureWidth: measureWidths[0],
      pageBreakBefore: !!nextPageBreak,
    };
  };

  if (measuresPerLine > 0 || lineSet.size > 0 || pageSet.size > 0) {
    const systems = [];
    let currentRow = [];
    let currentRowMeasureCount = 0;
    let nextPageBreak = false;
    let yAcc = 0;
    for (let i = 0; i < measures.length; i++) {
      const forceLine = lineSet.has(i);
      const forcePage = pageSet.has(i);
      const forceBreak = forceLine || forcePage || (enforceMeasuresPerLine && effectiveMeasuresPerLine > 0 && currentRowMeasureCount >= effectiveMeasuresPerLine && currentRow.length > 0);
      if (forceBreak && currentRow.length > 0) {
        const sys = buildSystem([...currentRow], systems.length, nextPageBreak);
        if (sys) {
          const placed = placeSystemY(yAcc, systems.length, nextPageBreak);
          if (placed.pageBreak) sys.pageBreakBefore = true;
          sys.yOffset = placed.y;
          yAcc = placed.y + step;
          nextPageBreak = false;
          systems.push(sys);
        }
        currentRow = [];
        currentRowMeasureCount = 0;
      }
      if (forcePage) nextPageBreak = true;
      currentRow.push(i);
      currentRowMeasureCount += getMeasureCountWeight(i);
    }
    if (currentRow.length > 0) {
      const sys = buildSystem(currentRow, systems.length, nextPageBreak);
      if (sys) {
        const placed = placeSystemY(yAcc, systems.length, nextPageBreak);
        if (placed.pageBreak) sys.pageBreakBefore = true;
        sys.yOffset = placed.y;
        systems.push(sys);
      }
    }
    if (systems.length === 0) {
      systems.push({
        systemIndex: 0,
        measureIndices: [],
        measureWidths: [],
        yOffset: 0,
        pixelsPerBeat: desiredPixelsPerBeat,
        measureWidth: beatsPerMeasure * desiredPixelsPerBeat,
        pageBreakBefore: false,
      });
    }
    return systems;
  }

  const systems = [];
  let measureIdx = 0;
  let systemIndex = 0;
  let lastPlacedY = 0;
  const minMeasureWidth = LAYOUT.MEASURE_MIN_WIDTH || 28;
  while (measureIdx < measures.length) {
    let rowNaturalWidth = 0;
    const rowIndices = [];
    while (measureIdx + rowIndices.length < measures.length) {
      const nextIdx = measureIdx + rowIndices.length;
      const nextWidth = getNaturalMeasureWidth(nextIdx);
      if (rowIndices.length > 0 && rowNaturalWidth + nextWidth > availableWidth + 0.5) break;
      if (rowIndices.length > 0 && nextWidth < minMeasureWidth && rowNaturalWidth + nextWidth > availableWidth * 0.98) break;
      rowIndices.push(nextIdx);
      rowNaturalWidth += nextWidth;
    }
    if (rowIndices.length === 0) {
      rowIndices.push(measureIdx);
    }
    const sys = buildSystem(rowIndices, systemIndex, false);
    if (sys) {
      const proposedY = systemIndex === 0 ? 0 : lastPlacedY + step;
      const placed = placeSystemY(proposedY, systemIndex, false);
      sys.yOffset = placed.y;
      sys.pageBreakBefore = placed.pageBreak;
      systems.push(sys);
      lastPlacedY = placed.y;
    }
    measureIdx += rowIndices.length;
    systemIndex++;
  }
  if (systems.length === 0) {
    systems.push({
      systemIndex: 0,
      measureIndices: [],
      measureWidths: [],
      yOffset: 0,
      pixelsPerBeat: desiredPixelsPerBeat,
      measureWidth: beatsPerMeasure * desiredPixelsPerBeat,
      pageBreakBefore: false,
    });
  }
  return systems;
}

/**
 * Taktide laiendamine/kokkusurumine: tagastab uue measureStretchFactors massiivi.
 * factorDelta > 0 = laienda (}), factorDelta < 0 = suru kokku ({).
 */
export function applyMeasureStretch(measureStretchFactors, measureIndex, factorDelta, minFactor = 0.25, maxFactor = 3) {
  const arr = [...(measureStretchFactors || [])];
  const current = typeof arr[measureIndex] === 'number' ? arr[measureIndex] : 1;
  arr[measureIndex] = Math.min(maxFactor, Math.max(minFactor, current + factorDelta));
  return arr;
}
