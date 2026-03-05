/**
 * LayoutEngine – ühtne paigutuse arvutus režiimiti (figure, traditional, pedagogical).
 * Kasutab lehe suunda (orientation) ja andmeid (measures, timeSignature, layoutOptions).
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

const DEFAULT_BOXES_PER_ROW = 4;
const PIXELS_PER_BEAT_DEFAULT = 80;
const SYSTEM_GAP = 120;

function getSystemStep() {
  return getStaffHeight() + SYSTEM_GAP;
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

  switch (mode) {
    case 'figure':
      return calculateFigureGrid(data, availableWidth);
    case 'traditional':
      return calculateTraditionalSystems(data, availableWidth);
    case 'pedagogical':
      return calculateFreeFlow(data, availableWidth);
    default:
      return calculateTraditionalSystems(data, availableWidth);
  }
}

/**
 * Figuurnotatsioon: rütmikastid fikseeritud (nt 4 kasti reas), võrdne laius takti kohta.
 */
function calculateFigureGrid(data, availableWidth) {
  const measures = data?.measures ?? [];
  const boxesPerRow = data?.boxesPerRow ?? DEFAULT_BOXES_PER_ROW;
  const timeSignature = data?.timeSignature ?? { beats: 4, beatUnit: 4 };
  const beatsPerMeasure = timeSignature?.beats ?? 4;

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
  const step = getSystemStep();

  for (let start = 0; start < measures.length; start += boxesPerRow) {
    const rowIndices = [];
    for (let i = 0; i < boxesPerRow && start + i < measures.length; i++) {
      rowIndices.push(start + i);
    }
    const measureWidths = rowIndices.map(() => boxWidth);
    const totalBeats = rowIndices.reduce((sum, i) => sum + (measures[i].beatCount ?? beatsPerMeasure), 0);
    const pixelsPerBeatForRow = totalBeats > 0 ? (boxWidth * rowIndices.length) / totalBeats : PIXELS_PER_BEAT_DEFAULT;

    systems.push({
      systemIndex: systems.length,
      measureIndices: rowIndices,
      measureWidths,
      yOffset: systems.length * step,
      pixelsPerBeat: pixelsPerBeatForRow,
      measureWidth: boxWidth,
      pageBreakBefore: false,
    });
  }

  return systems;
}

/**
 * Traditsiooniline notatsioon: taktid venivad (flex-growth), kasutab LayoutManager.computeLayout.
 */
function calculateTraditionalSystems(data, availableWidth) {
  const measures = data?.measures ?? [];
  const timeSignature = data?.timeSignature ?? { beats: 4, beatUnit: 4 };
  const pixelsPerBeat = data?.pixelsPerBeat ?? PIXELS_PER_BEAT_DEFAULT;
  const layoutOptions = data?.layoutOptions ?? {};
  const pageWidth = availableWidth + (LAYOUT.MARGIN_LEFT ?? 60) + (LAYOUT.MARGIN_RIGHT ?? 40);

  return computeLayout(measures, timeSignature, pixelsPerBeat, pageWidth, {
    ...layoutOptions,
    measuresPerLine: layoutOptions.measuresPerLine ?? 0,
  });
}

/**
 * Vabanotatsioon (pedagogical): JO-võtme asukoht ja ridade vaba vool.
 * Praegu sarnane traditional-iga; võib tulevikus arvestada reavahetusi JO positsiooni või fraaside järgi.
 */
function calculateFreeFlow(data, availableWidth) {
  const measures = data?.measures ?? [];
  const timeSignature = data?.timeSignature ?? { beats: 4, beatUnit: 4 };
  const pixelsPerBeat = data?.pixelsPerBeat ?? PIXELS_PER_BEAT_DEFAULT;
  const layoutOptions = data?.layoutOptions ?? {};
  const pageWidth = availableWidth + (LAYOUT.MARGIN_LEFT ?? 60) + (LAYOUT.MARGIN_RIGHT ?? 40);

  return computeLayout(measures, timeSignature, pixelsPerBeat, pageWidth, {
    ...layoutOptions,
    measuresPerLine: layoutOptions.measuresPerLine ?? 0,
  });
}
