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

/**
 * Layout Y uses the inner score box (paper minus padding). The first page is shorter
 * because the title/author block sits above the SVG.
 */
export function getNotationPageBodies(pageInnerHeightPx, headerReservePx = 0) {
  const pageH = Math.max(0, Number(pageInnerHeightPx) || 0);
  if (!(pageH > 0)) return { pageH: 0, firstBody: 0, restBody: 0 };
  const reserveRaw = Number(headerReservePx);
  const reserve = Number.isFinite(reserveRaw) && reserveRaw > 0
    ? Math.min(Math.max(0, reserveRaw), Math.max(0, pageH - 120))
    : 0;
  const firstBody = Math.max(120, pageH - reserve);
  return { pageH, firstBody, restBody: pageH };
}

export function pageContentBottomForLayoutY(y, firstBody, restBody) {
  const yy = Math.max(0, Number(y) || 0);
  const first = Math.max(1, Number(firstBody) || 1);
  const rest = Math.max(1, Number(restBody) || first);
  if (yy < first) return first;
  const idx = Math.floor((yy - first) / rest);
  return first + (idx + 1) * rest;
}

/** Keep-out so a staff is not packed into the last sliver of a page. */
export function resolvePageEdgeGutterPx(occupyHeight, pageSpanPx, pageEdgeReservePx = 0) {
  const occupy = Math.max(0, Number(occupyHeight) || 0);
  const span = Math.max(1, Number(pageSpanPx) || 1);
  const reserve = Math.max(0, Number(pageEdgeReservePx) || 0);
  const gutter = Math.max(reserve, Math.round(occupy * 0.3));
  const maxGutter = Math.max(0, Math.floor(span * 0.28));
  return Math.min(gutter, maxGutter);
}

/** If a system would cross a page edge (or a manual page break), place it at the next page start. */
export function snapSystemYToPage({
  proposedY,
  occupyHeight,
  firstBody,
  restBody,
  forcePageBreak = false,
  isFirstSystem = false,
  pageEdgeReservePx = 0,
} = {}) {
  const y0 = Math.max(0, Number(proposedY) || 0);
  const occupy = Math.max(0, Number(occupyHeight) || 0);
  if (!(Number(firstBody) > 0) || !(Number(restBody) > 0)) {
    return { y: y0, pageBreak: !!forcePageBreak };
  }
  if (isFirstSystem && !forcePageBreak) return { y: y0, pageBreak: false };
  const bottom = pageContentBottomForLayoutY(y0, firstBody, restBody);
  const pageSpan = y0 < firstBody ? firstBody : restBody;
  const gutter = resolvePageEdgeGutterPx(occupy, pageSpan, pageEdgeReservePx);
  const usableBottom = bottom - gutter;
  if (forcePageBreak || y0 + occupy > usableBottom) {
    return { y: bottom, pageBreak: true };
  }
  return { y: y0, pageBreak: false };
}

export function physicalPageIndexForLayoutY(y, firstBody, restBody) {
  const yy = Math.max(0, Number(y) || 0);
  const first = Math.max(1, Number(firstBody) || 1);
  const rest = Math.max(1, Number(restBody) || first);
  if (yy < first) return 0;
  return 1 + Math.floor((yy - first) / rest);
}

/**
 * Screen desk: each paper stripe is full A4 (including padding). Layout Y is inner-only.
 * Crossing a page must skip desk gap + that per-page padding, or the staff sits in the empty band.
 */
export function layoutYToDeskDisplayY(layoutY, {
  firstBody,
  restBody,
  deskGapPx = 0,
  pageFrameYPx = 0,
} = {}) {
  const y = Number(layoutY) || 0;
  const pageIndex = physicalPageIndexForLayoutY(y, firstBody, restBody);
  const extra = Math.max(0, Number(deskGapPx) || 0) + Math.max(0, Number(pageFrameYPx) || 0);
  return y + pageIndex * extra;
}
