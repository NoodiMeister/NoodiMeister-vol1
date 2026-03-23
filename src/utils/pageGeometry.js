const MM_PER_INCH = 25.4;
const PX_PER_INCH = 96;
const PT_PER_INCH = 72;

export const PAPER_SIZES_MM = {
  a5: { width: 148, height: 210 },
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
};

export function normalizePaperSize (paperSize) {
  return PAPER_SIZES_MM[paperSize] ? paperSize : 'a4';
}

export function normalizePageOrientation (orientation) {
  return orientation === 'landscape' ? 'landscape' : 'portrait';
}

export function getExportOrientation (pageOrientation, pageFlowDirection = 'vertical') {
  return pageFlowDirection === 'horizontal'
    ? 'landscape'
    : normalizePageOrientation(pageOrientation);
}

export function mmToPx (mm, dpi = PX_PER_INCH) {
  return Math.round((Number(mm) * dpi) / MM_PER_INCH);
}

export function mmToPt (mm) {
  return (Number(mm) * PT_PER_INCH) / MM_PER_INCH;
}

export function getPaperDimensionsMm (paperSize = 'a4', orientation = 'portrait') {
  const sizeKey = normalizePaperSize(paperSize);
  const safeOrientation = normalizePageOrientation(orientation);
  const base = PAPER_SIZES_MM[sizeKey];
  if (safeOrientation === 'landscape') {
    return { width: base.height, height: base.width };
  }
  return { width: base.width, height: base.height };
}

export function getPaperDimensionsPx (paperSize = 'a4', orientation = 'portrait', dpi = PX_PER_INCH) {
  const dimsMm = getPaperDimensionsMm(paperSize, orientation);
  return {
    width: mmToPx(dimsMm.width, dpi),
    height: mmToPx(dimsMm.height, dpi),
  };
}

export function getPaperDimensionsPt (paperSize = 'a4', orientation = 'portrait') {
  const dimsMm = getPaperDimensionsMm(paperSize, orientation);
  return {
    width: mmToPt(dimsMm.width),
    height: mmToPt(dimsMm.height),
  };
}

export function getPageMetrics ({ paperSize = 'a4', orientation = 'portrait' } = {}) {
  const safePaperSize = normalizePaperSize(paperSize);
  const safeOrientation = normalizePageOrientation(orientation);
  const dimsMm = getPaperDimensionsMm(safePaperSize, safeOrientation);
  const dimsPx = getPaperDimensionsPx(safePaperSize, safeOrientation);
  const dimsPt = getPaperDimensionsPt(safePaperSize, safeOrientation);
  return {
    paperSize: safePaperSize,
    orientation: safeOrientation,
    widthMm: dimsMm.width,
    heightMm: dimsMm.height,
    widthPx: dimsPx.width,
    heightPx: dimsPx.height,
    widthPt: dimsPt.width,
    heightPt: dimsPt.height,
    heightRatio: dimsPx.height / Math.max(1, dimsPx.width),
  };
}

export function getPageCount (contentExtentPx, pageExtentPx) {
  const safePageExtent = Math.max(1, Number(pageExtentPx) || 1);
  const safeContentExtent = Math.max(safePageExtent, Number(contentExtentPx) || safePageExtent);
  return Math.max(1, Math.ceil(safeContentExtent / safePageExtent));
}
