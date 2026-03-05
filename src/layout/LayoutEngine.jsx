/**
 * LayoutEngine – ühtne paigutuse arvutus režiimiti (figure, traditional, pedagogical).
 * Kasutab lehe suunda (orientation) ja andmeid (measures, timeSignature, layoutOptions).
 * Toetab mitut joonestikku (staff) süsteemi kohta – iga instrument oma joonestik.
 */
import { computeLayout, getStaffHeight, LAYOUT } from './LayoutManager';

/** A4 proportsioon (laius : kõrgus). */
const A4_RATIO = 297 / 210;

/** Vaikimisi lehe mõõdud (px). Portrait = LAYOUT.PAGE_WIDTH_MIN laius, kõrgus suhtest. */
export const PAGE_DIMENSIONS = {
  portrait: {
    width: 794,
    height: Math.round(794 * A4_RATIO),
    margin: 60,
  },
  landscape: {
    width: Math.round(1123 * (210 / 297)),
    height: 794,
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
const PIXELS_PER_BEAT_DEFAULT = 80;
const SYSTEM_GAP = 120;

/** Vaikimisi laius ühe veerandnooti (1/4) kohta figuurnotatsioonis (px). */
export const FIGURE_BASE_WIDTH = 28;

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

  switch (mode) {
    case 'figure':
      return calculateFigureGrid(data, availableWidth, availablePageHeight);
    case 'traditional':
      return calculateTraditionalSystems(data, availableWidth, dims, availablePageHeight);
    case 'pedagogical':
      return calculateFreeFlow(data, availableWidth, dims, availablePageHeight);
    default:
      return calculateTraditionalSystems(data, availableWidth, dims, availablePageHeight);
  }
}

/**
 * Figuurnotatsioon: rütmikastid fikseeritud (nt 4 kasti reas), võrdne laius takti kohta.
 * Süsteemide Y: täpne joonestiku keskkohast järgmise keskkohani (staffSpacing).
 */
function calculateFigureGrid(data, availableWidth, availablePageHeight = 0) {
  const measures = data?.measures ?? [];
  const mult = Math.max(0.25, Math.min(3, Number(data?.globalSpacingMultiplier) || 1));
  const rawBoxesPerRow = data?.boxesPerRow ?? DEFAULT_BOXES_PER_ROW;
  const boxesPerRow = Math.max(1, Math.round(rawBoxesPerRow / mult));
  const timeSignature = data?.timeSignature ?? { beats: 4, beatUnit: 4 };
  const beatsPerMeasure = timeSignature?.beats ?? 4;
  const staffSpacing = Math.max(40, Number(data?.staffSpacing) || SYSTEM_GAP);

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
  const boxWidth = availableWidth / boxesPerRow;

  for (let start = 0; start < measures.length; start += boxesPerRow) {
    const sIndex = systems.length;
    const rowIndices = [];
    for (let i = 0; i < boxesPerRow && start + i < measures.length; i++) {
      rowIndices.push(start + i);
    }
    const measureWidths = rowIndices.map(() => boxWidth);
    const totalBeats = rowIndices.reduce((sum, i) => sum + (measures[i].beatCount ?? beatsPerMeasure), 0);
    const pixelsPerBeatForRow = totalBeats > 0 ? (boxWidth * rowIndices.length) / totalBeats : PIXELS_PER_BEAT_DEFAULT;

    const systemY = sIndex * staffSpacing;
    const pageBreakBefore = availablePageHeight > 0 && sIndex > 0
      && Math.floor(systemY / availablePageHeight) > Math.floor(((sIndex - 1) * staffSpacing) / availablePageHeight);

    systems.push({
      systemIndex: sIndex,
      measureIndices: rowIndices,
      measureWidths,
      yOffset: systemY,
      pixelsPerBeat: pixelsPerBeatForRow,
      measureWidth: boxWidth,
      pageBreakBefore,
    });
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
 * Vabanotatsioon (pedagogical): JO-võtme asukoht ja ridade vaba vool.
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
