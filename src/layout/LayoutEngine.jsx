/**
 * LayoutEngine – ühtne paigutuse arvutus režiimiti (figure, traditional, pedagogical).
 * Kasutab lehe suunda (orientation) ja andmeid (measures, timeSignature, layoutOptions).
 * Toetab mitut joonestikku (staff) süsteemi kohta – iga instrument oma joonestik.
 */
import { computeLayout, getStaffHeight, LAYOUT } from './LayoutManager';
import { measureLengthInQuarterBeats } from '../musical/timeSignature';

/** Vaikimisi lehe mõõdud (px). A4 96 DPI: 794×1123 (portrait), 1123×794 (landscape); suhe 1 : 1.414. */
export const PAGE_DIMENSIONS = {
  portrait: {
    width: LAYOUT.PAGE_WIDTH_PX,
    height: LAYOUT.PAGE_HEIGHT_PX,
    margin: 60,
  },
  landscape: {
    width: LAYOUT.PAGE_HEIGHT_PX,
    height: LAYOUT.PAGE_WIDTH_PX,
    margin: 60,
  },
};

const SYSTEM_GAP_DEFAULT = 120;

/**
 * Arvutab skaleerimisteguri, et kõik süsteemid (mitme joonestikuga) mahuksid ühele A4 lehele.
 * Kui instrumente on palju (nt 4+), vähendab skaalat (fonte ja vahesid).
 * @param {number} staffCount - joonestike arv ühes süsteemis (instrumentide arv)
 * @param {number} systemCount - süsteemide arv
 * @param {string} orientation - 'portrait' | 'landscape'
 * @returns {{ scale: number, staffHeight: number, staffSpace: number }}
 */
export function computeScaleForA4(staffCount, systemCount, orientation = 'portrait') {
  const dims = PAGE_DIMENSIONS[orientation] ?? PAGE_DIMENSIONS.portrait;
  const availableHeight = dims.height - dims.margin * 2;
  const baseStaffHeight = getStaffHeight();
  const systemGap = SYSTEM_GAP_DEFAULT;
  const oneSystemHeight = staffCount * baseStaffHeight + systemGap;
  const totalHeightNeeded = systemCount * oneSystemHeight;
  if (totalHeightNeeded <= 0 || availableHeight <= 0) {
    return { scale: 1, staffHeight: baseStaffHeight, staffSpace: 10 };
  }
  const scale = Math.min(1, availableHeight / totalHeightNeeded);
  const staffHeight = Math.max(40, Math.round(baseStaffHeight * scale));
  const staffSpace = Math.max(6, Math.round(10 * scale));
  return { scale, staffHeight, staffSpace };
}

const DEFAULT_BOXES_PER_ROW = 4;
const PIXELS_PER_BEAT_DEFAULT = 85;
const SYSTEM_GAP = 120;

/** Vaikimisi laius ühe veerandnooti (1/4) kohta figuurnotatsioonis (px). */
export const FIGURE_BASE_WIDTH = 28;

/** Height of one Figurenotes row (measure box row). Step between lines = FIGURE_ROW_HEIGHT + gap; same rule between every line. */
export const FIGURE_ROW_HEIGHT = 80;

/**
 * Tagastab figuurnoodi laiuse kestuse järgi (whole=4×, half=2×, quarter=1×, eighth=0.5×, sixteenth=0.25×).
 * @param {string} duration - durationLabel ('1/1', '1/2', '1/4', '1/8', '1/16') või võti ('whole', 'half', ...)
 * @param {number} baseWidth - baaslaius (nt FIGURE_BASE_WIDTH)
 * @returns {number} noodi laius px
 */
export function getFigureNoteWidth(duration, baseWidth = FIGURE_BASE_WIDTH) {
  const durationToKey = {
    '1/1': 'whole', '1/2': 'half', '1/4': 'quarter', '1/8': 'eighth', '1/16': 'sixteenth',
    'whole': 'whole', 'half': 'half', 'quarter': 'quarter', 'eighth': 'eighth', 'sixteenth': 'sixteenth',
  };
  const multipliers = {
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5,
    sixteenth: 0.25,
  };
  const key = durationToKey[duration] || 'quarter';
  return baseWidth * (multipliers[key] ?? 1);
}

/**
 * Ühtne paigutuse arvutus: režiim + suund + andmed.
 * @param {string} mode - 'figure' | 'traditional' | 'pedagogical'
 * @param {string} orientation - 'portrait' | 'landscape'
 * @param {object} data - { measures, timeSignature, pixelsPerBeat?, layoutOptions?, boxesPerRow? }
 * @returns {Array} systems (systemIndex, measureIndices, measureWidths, yOffset, pixelsPerBeat, measureWidth?, pageBreakBefore?)
 */
export function calculateLayout(mode, orientation, data) {
  const dims = PAGE_DIMENSIONS[orientation] ?? PAGE_DIMENSIONS.portrait;
  const availableWidth = dims.width - dims.margin * 2;
  const availablePageHeight = dims.height - dims.margin * 2;

  const figurePageHeight = (typeof data?.pageHeight === 'number' && data.pageHeight > 0)
    ? data.pageHeight
    : availablePageHeight;

  switch (mode) {
    case 'figure':
      return calculateFigureGrid(data, availableWidth, figurePageHeight);
    case 'traditional':
      return calculateTraditionalSystems(data, availableWidth, dims, availablePageHeight);
    case 'pedagogical':
      return calculateFreeFlow(data, availableWidth, dims, availablePageHeight);
    default:
      return calculateTraditionalSystems(data, availableWidth, dims, availablePageHeight);
  }
}

/**
 * Figuurnotatsioon: rütmikastid reas; võrdne laius takti kohta rea sees.
 * Kasutab bar layout tööriista: lineBreakBefore / pageBreakBefore (1-based measure index = break before that measure).
 * Süsteemide Y: yOffset = systemIndex * staffSpacing (staffSpacing = rea kõrgus + vahe). A4: kui rida ei mahu lehele, pageBreakBefore.
 */
function calculateFigureGrid(data, availableWidth, availablePageHeight = 0) {
  const measures = data?.measures ?? [];
  const mult = Math.max(0.25, Math.min(3, Number(data?.globalSpacingMultiplier) || 1));
  const figureSizeBase = Math.max(12, Math.min(96, Number(data?.figurenotesSize) || 85));
  const figureScale = Math.max(0.5, figureSizeBase / 75);
  const rawBoxesPerRow = data?.boxesPerRow ?? DEFAULT_BOXES_PER_ROW;
  const boxesPerRow = Math.max(1, Math.round(rawBoxesPerRow / mult));
  const lineBreakBefore = new Set(Array.isArray(data?.lineBreakBefore) ? data.lineBreakBefore : []);
  const pageBreakBefore = new Set(Array.isArray(data?.pageBreakBefore) ? data.pageBreakBefore : []);
  const timeSignature = data?.timeSignature ?? { beats: 4, beatUnit: 4 };
  const beatsPerMeasure = measureLengthInQuarterBeats(timeSignature);
  const staffSpacing = Math.max(FIGURE_ROW_HEIGHT, Number(data?.staffSpacing) || SYSTEM_GAP);

  // Reserve a small right-edge safety area so larger figure symbols never render past the page stripe.
  const edgeSafetyPadPx = Math.max(0, Math.round(figureSizeBase * 0.6));
  const rawEffectiveWidth = typeof data?.pageWidth === 'number' && data.pageWidth > 0
    ? Math.max(200, data.pageWidth - LAYOUT.MARGIN_LEFT - LAYOUT.MARGIN_RIGHT)
    : availableWidth;
  const effectiveWidth = Math.max(200, rawEffectiveWidth - edgeSafetyPadPx);

  const pageHeight = availablePageHeight > 0 ? availablePageHeight : null;

  if (measures.length === 0) {
    return [{
      systemIndex: 0,
      measureIndices: [],
      measureWidths: [],
      yOffset: 0,
      pixelsPerBeat: PIXELS_PER_BEAT_DEFAULT,
      measureWidth: beatsPerMeasure * PIXELS_PER_BEAT_DEFAULT,
      pageBreakBefore: false,
    }];
  }

  const systems = [];
  let lastYOffset = -staffSpacing;
  let currentRow = [];

  const pixelsPerBeatInput = typeof data?.pixelsPerBeat === 'number' && data.pixelsPerBeat > 0 ? data.pixelsPerBeat : null;

  const flushRow = (rowIndices) => {
    if (rowIndices.length === 0) return;
    const sIndex = systems.length;
    let measureWidths;
    let pixelsPerBeatForRow;
    if (pixelsPerBeatInput != null) {
      measureWidths = rowIndices.map((i) => (measures[i].beatCount ?? beatsPerMeasure) * pixelsPerBeatInput);
      const totalBeats = rowIndices.reduce((sum, i) => sum + (measures[i].beatCount ?? beatsPerMeasure), 0);
      pixelsPerBeatForRow = totalBeats > 0 ? pixelsPerBeatInput : PIXELS_PER_BEAT_DEFAULT;
    } else {
      const boxWidth = effectiveWidth / rowIndices.length;
      measureWidths = rowIndices.map(() => boxWidth);
      const totalBeats = rowIndices.reduce((sum, i) => sum + (measures[i].beatCount ?? beatsPerMeasure), 0);
      pixelsPerBeatForRow = totalBeats > 0 ? (boxWidth * rowIndices.length) / totalBeats : PIXELS_PER_BEAT_DEFAULT;
    }
    const boxWidth = measureWidths[0] ?? effectiveWidth / rowIndices.length;

    let systemY = lastYOffset + staffSpacing;
    const userPageBreak = rowIndices.some((m) => pageBreakBefore.has(m + 1));
    let doPageBreak = userPageBreak;
    if (pageHeight != null && pageHeight > 0 && sIndex > 0) {
      const pageTop = Math.floor(systemY / pageHeight) * pageHeight;
      const pageBottom = pageTop + pageHeight;
      if (systemY + staffSpacing > pageBottom) {
        doPageBreak = true;
        systemY = pageBottom;
      }
    }

    lastYOffset = systemY;
    systems.push({
      systemIndex: sIndex,
      measureIndices: [...rowIndices],
      measureWidths,
      yOffset: systemY,
      pixelsPerBeat: pixelsPerBeatForRow,
      measureWidth: boxWidth,
      pageBreakBefore: doPageBreak,
    });
  };

  const minMeasureWidth = Math.max(
    LAYOUT.MEASURE_MIN_WIDTH ?? 28,
    beatsPerMeasure * (FIGURE_BASE_WIDTH * figureScale)
  );

  for (let i = 0; i < measures.length; i++) {
    const breakBeforeThis = lineBreakBefore.has(i + 1) || pageBreakBefore.has(i + 1);
    const fullRow = currentRow.length >= boxesPerRow;
    const wouldBeCount = currentRow.length + 1;
    const widthPerMeasure = effectiveWidth / wouldBeCount;
    const overflowBreak = currentRow.length > 0 && widthPerMeasure < minMeasureWidth; // force new line when row would overflow

    if ((breakBeforeThis || fullRow || overflowBreak) && currentRow.length > 0) {
      flushRow(currentRow);
      currentRow = [];
    }
    currentRow.push(i);
  }

  if (currentRow.length > 0) {
    flushRow(currentRow);
  }

  return systems;
}

/**
 * Traditsiooniline notatsioon: taktid venivad (flex-growth), kasutab LayoutManager.computeLayout.
 * staffSpacing määrab süsteemide Y (keskkohast keskkohani); lehevahetus automaatne A4 järgi.
 */
function calculateTraditionalSystems(data, availableWidth, dims, availablePageHeight) {
  const measures = data?.measures ?? [];
  const timeSignature = data?.timeSignature ?? { beats: 4, beatUnit: 4 };
  const pixelsPerBeat = data?.pixelsPerBeat ?? PIXELS_PER_BEAT_DEFAULT;
  const layoutOptions = data?.layoutOptions ?? {};
  const pageWidth = availableWidth + (LAYOUT.MARGIN_LEFT ?? 60) + (LAYOUT.MARGIN_RIGHT ?? 40);
  const globalSpacingMultiplier = data?.globalSpacingMultiplier ?? 1;
  const staffSpacing = Math.max(40, Number(data?.staffSpacing) || SYSTEM_GAP);

  return computeLayout(measures, timeSignature, pixelsPerBeat, pageWidth, {
    ...layoutOptions,
    measuresPerLine: layoutOptions.measuresPerLine ?? 0,
    globalSpacingMultiplier,
    staffSpacing,
    pageHeight: availablePageHeight > 0 ? availablePageHeight : undefined,
  });
}

/**
 * Pedagoogiline notatsioon (pedagogical): JO-võtme asukoht ja ridade vaba vool.
 * staffSpacing ja lehevahetus nagu traditional.
 */
function calculateFreeFlow(data, availableWidth, dims, availablePageHeight) {
  const measures = data?.measures ?? [];
  const timeSignature = data?.timeSignature ?? { beats: 4, beatUnit: 4 };
  const pixelsPerBeat = data?.pixelsPerBeat ?? PIXELS_PER_BEAT_DEFAULT;
  const layoutOptions = data?.layoutOptions ?? {};
  const pageWidth = availableWidth + (LAYOUT.MARGIN_LEFT ?? 60) + (LAYOUT.MARGIN_RIGHT ?? 40);
  const globalSpacingMultiplier = data?.globalSpacingMultiplier ?? 1;
  const staffSpacing = Math.max(40, Number(data?.staffSpacing) || SYSTEM_GAP);

  return computeLayout(measures, timeSignature, pixelsPerBeat, pageWidth, {
    ...layoutOptions,
    measuresPerLine: layoutOptions.measuresPerLine ?? 0,
    globalSpacingMultiplier,
    staffSpacing,
    pageHeight: availablePageHeight > 0 ? availablePageHeight : undefined,
  });
}
