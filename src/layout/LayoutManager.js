/**
 * Paigutusmoodul: A4 formaat, takti laiendamine/kokkusurumine ({ }), ridade vertikaalne liigutamine.
 * Ekspordib computeLayout, LAYOUT konstandid ja getStaffHeight.
 */

export const LAYOUT = {
  PAGE_WIDTH_MIN: 800,
  PAGE_WIDTH_MAX: 1000,
  PAGE_WIDTH_MAX_LANDSCAPE: 1400,
  A4_HEIGHT_RATIO: 297 / 210,
  SYSTEM_GAP: 120,
  MARGIN_LEFT: 60,
  MARGIN_RIGHT: 40,
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
 */
export function computeLayout(measures, timeSignature, pixelsPerBeat, pageWidth, layoutOptions = {}) {
  const w = Number(pageWidth) || LAYOUT.PAGE_WIDTH_MIN;
  const availableWidth = Math.max(200, w - LAYOUT.MARGIN_LEFT - LAYOUT.MARGIN_RIGHT);
  const beatsPerMeasure = timeSignature?.beats ?? 4;
  const {
    measuresPerLine = 0,
    lineBreakBefore = [],
    pageBreakBefore = [],
    systemGap = LAYOUT.SYSTEM_GAP,
    staffCount = 1,
    measureStretchFactors = [],
  } = layoutOptions;
  const step = (staffCount || 1) * getStaffHeight() + systemGap;
  const lineSet = new Set(Array.isArray(lineBreakBefore) ? lineBreakBefore : []);
  const pageSet = new Set(Array.isArray(pageBreakBefore) ? pageBreakBefore : []);
  const getFactor = (i) => (Array.isArray(measureStretchFactors) && typeof measureStretchFactors[i] === 'number')
    ? measureStretchFactors[i]
    : 1;

  const buildSystem = (rowIndices, systemIndex, nextPageBreak) => {
    if (rowIndices.length === 0) return null;
    const totalWeight = rowIndices.reduce((sum, i) => sum + (measures[i].beatCount ?? beatsPerMeasure) * getFactor(i), 0);
    if (totalWeight <= 0) return null;
    const measureWidths = rowIndices.map((i) => {
      const beats = measures[i].beatCount ?? beatsPerMeasure;
      return (beats * getFactor(i) / totalWeight) * availableWidth;
    });
    const totalBeatCount = rowIndices.reduce((sum, i) => sum + (measures[i].beatCount ?? beatsPerMeasure), 0);
    const pixelsPerBeatForRow = totalBeatCount > 0 ? availableWidth / totalBeatCount : pixelsPerBeat;
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
    let nextPageBreak = false;
    let yAcc = 0;
    for (let i = 0; i < measures.length; i++) {
      const forceLine = lineSet.has(i);
      const forcePage = pageSet.has(i);
      const forceBreak = forceLine || forcePage || (measuresPerLine > 0 && currentRow.length >= measuresPerLine && currentRow.length > 0);
      if (forceBreak && currentRow.length > 0) {
        const sys = buildSystem([...currentRow], systems.length, nextPageBreak);
        if (sys) {
          sys.yOffset = yAcc;
          yAcc += step;
          if (nextPageBreak) {
            yAcc += PAGE_BREAK_GAP;
            nextPageBreak = false;
          }
          systems.push(sys);
        }
        currentRow = [];
      }
      if (forcePage) nextPageBreak = true;
      currentRow.push(i);
    }
    if (currentRow.length > 0) {
      const sys = buildSystem(currentRow, systems.length, nextPageBreak);
      if (sys) {
        sys.yOffset = yAcc;
        systems.push(sys);
      }
    }
    if (systems.length === 0) {
      systems.push({
        systemIndex: 0,
        measureIndices: [],
        measureWidths: [],
        yOffset: 0,
        pixelsPerBeat,
        measureWidth: beatsPerMeasure * pixelsPerBeat,
        pageBreakBefore: false,
      });
    }
    return systems;
  }

  const systems = [];
  let measureIdx = 0;
  let systemIndex = 0;
  while (measureIdx < measures.length) {
    let totalBeatCount = 0;
    const rowIndices = [];
    while (measureIdx + rowIndices.length < measures.length) {
      const nextIdx = measureIdx + rowIndices.length;
      const nextBeatCount = measures[nextIdx].beatCount ?? beatsPerMeasure;
      const wouldBeTotal = totalBeatCount + nextBeatCount;
      const wouldBePixelsPerBeat = availableWidth / wouldBeTotal;
      const nextMeasureWidth = nextBeatCount * wouldBePixelsPerBeat;
      if (rowIndices.length > 0 && nextMeasureWidth < (LAYOUT.MEASURE_MIN_WIDTH || 28)) break;
      rowIndices.push(nextIdx);
      totalBeatCount = wouldBeTotal;
    }
    if (rowIndices.length === 0) {
      rowIndices.push(measureIdx);
      totalBeatCount = measures[measureIdx].beatCount ?? beatsPerMeasure;
    }
    const totalWeight = rowIndices.reduce((sum, i) => sum + (measures[i].beatCount ?? beatsPerMeasure) * getFactor(i), 0);
    const measureWidths = totalWeight > 0
      ? rowIndices.map((i) => ((measures[i].beatCount ?? beatsPerMeasure) * getFactor(i) / totalWeight) * availableWidth)
      : rowIndices.map((i) => (measures[i].beatCount ?? beatsPerMeasure) * (availableWidth / totalBeatCount));
    const pixelsPerBeatForRow = totalBeatCount > 0 ? availableWidth / totalBeatCount : pixelsPerBeat;
    systems.push({
      systemIndex,
      measureIndices: rowIndices,
      measureWidths,
      yOffset: systemIndex * step,
      pixelsPerBeat: pixelsPerBeatForRow,
      measureWidth: measureWidths[0],
      pageBreakBefore: false,
    });
    measureIdx += rowIndices.length;
    systemIndex++;
  }
  if (systems.length === 0) {
    systems.push({
      systemIndex: 0,
      measureIndices: [],
      measureWidths: [],
      yOffset: 0,
      pixelsPerBeat,
      measureWidth: beatsPerMeasure * pixelsPerBeat,
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
