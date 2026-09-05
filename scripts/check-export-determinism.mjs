import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { layoutYToDeskDisplayY, snapSystemYToPage, getNotationPageBodies } from '../src/utils/pageGeometry.js';
import {
  getFigureContentWidthPx,
  maxPixelsPerBeatToFitPage,
  clampPixelsPerBeatToPage,
  fitWidthsToContentWidth,
} from '../src/layout/pageFitSpacing.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function read(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return readFile(absolutePath, 'utf8');
}

async function main() {
  const scoreToSvg = await read('src/utils/scoreToSvg.js');
  const app = await read('src/noodimeister-complete.jsx');
  const exportFontAssets = await read('src/export/exportFontAssets.js');
  const smuflGlyphs = await read('src/notation/smufl/glyphs.js');
  const figurenotesView = await read('src/views/FigurenotesView.jsx');
  const scoreDocumentModel = await read('src/document/scoreDocumentModel.js');

  assert(scoreToSvg.includes('export function buildScoreSceneSnapshot'), 'Missing DOM-free scene snapshot builder.');
  assert(scoreDocumentModel.includes('describeScoreDocumentBlocksForExport'), 'Unified score document block model is missing.');
  assert(scoreDocumentModel.includes('buildScoreTextBoxesExportMarkup'), 'Text box export markup must live in score document model.');
  assert(scoreToSvg.includes('describeScoreDocumentBlocksForExport'), 'scoreToSvg must wire document block metadata.');
  assert(app.includes('textBoxes,'), 'Export snapshot must pass textBoxes into scoreToSvg for unified document parity.');
  assert(!scoreToSvg.includes('local("serif")'), 'Export defs still depend on local serif fallback.');
  assert(app.includes('scoreToSvg(containerEl,'), 'Preview/PDF path is not using scoreToSvg snapshot builder.');
  assert(
    app.includes('buildNmPrintSvgPagesMarkup') && app.includes('runIsolatedPrintFromHtml'),
    'Print must embed score pages via buildNmPrintSvgPagesMarkup + runIsolatedPrintFromHtml (isolated document).'
  );
  assert(exportFontAssets.includes('CANONICAL_SMUFL_FONT_FAMILY = \'Leland\''), 'Canonical Leland font family constant is missing.');
  assert(exportFontAssets.includes('font-family: \'${CANONICAL_SMUFL_FONT_FAMILY}\''), 'Leland alias font-face is missing.');
  assert(exportFontAssets.includes('@fontsource/bravura/files/bravura-latin-400-normal.woff2'), 'Leland is not mapped to bundled Bravura.');
  assert(exportFontAssets.includes('getCanonicalSmuflFontMeta'), 'Canonical SMuFL font meta helper is missing.');
  assert(scoreToSvg.includes('validateSmuflTimeSigExport'), 'SMuFL time-signature export validator is missing.');
  assert(app.includes('validateSmuflTimeSigExport({ defsString: previewSvgData.defsString, contentString: previewSvgData.contentString })'), 'PDF export is missing SMuFL preflight validation.');
  assert(app.includes('validateSmuflTimeSigExport({ defsString: pdfPreviewSvgData.defsString, contentString: pdfPreviewSvgData.contentString })'), 'Print export is missing SMuFL preflight validation.');
  assert(app.includes('registerSmuflFontsForJsPdf'), 'PDF/print path must register SMuFL (Bravura) with jsPDF before svg2pdf.');
  assert(smuflGlyphs.includes("export const SMUFL_MUSIC_FONT_FAMILY = 'Leland';"), 'Canonical SMuFL font family constant is missing.');
  assert(figurenotesView.includes('fontFamily={SMUFL_MUSIC_FONT_FAMILY}'), 'Figurenotes time signature is not forced to canonical SMuFL font family.');
  assert(
    /if\s*\(\s*!chordBlocksEnabled\s*\|\|\s*chordLineHeight\s*<=\s*0\s*\)\s*\{\s*return null;/.test(figurenotesView),
    'Figurenotes must hide chord names when chord blocks are off (no melody overlay fallback).'
  );
  assert(app.includes('physicalPageFrameYPx={scorePaddingYPx}'), 'Screen layout must skip per-page paper padding when mapping systems across desk gaps.');
  assert(app.includes('layoutYToDeskDisplayY'), 'Timeline must map layout Y through layoutYToDeskDisplayY.');

  const landscapeInner = 681;
  const headerReserve = 140;
  const { firstBody, restBody } = getNotationPageBodies(landscapeInner, headerReserve);
  const occupy = 165;
  const placed = snapSystemYToPage({
    proposedY: 500,
    occupyHeight: occupy,
    firstBody,
    restBody,
    isFirstSystem: false,
  });
  assert(placed.pageBreak === true && placed.y === firstBody, 'Landscape overflow must snap the staff to the next page start, not into the page gap.');
  const almostFits = snapSystemYToPage({
    proposedY: 330,
    occupyHeight: occupy,
    firstBody,
    restBody,
    isFirstSystem: false,
    pageEdgeReservePx: 68,
  });
  assert(
    almostFits.pageBreak === true && almostFits.y === firstBody,
    'A staff that would sit in the page-edge gutter must move to the next page.'
  );
  const deskY = layoutYToDeskDisplayY(placed.y, {
    firstBody,
    restBody,
    deskGapPx: 28,
    pageFrameYPx: 113,
  });
  assert(deskY === firstBody + 28 + 113, 'Desk display Y must add desk gap plus full-A4 padding per crossed page.');
  assert(app.includes('effectivePixelsPerBeat'), 'Loose/normal spacing must use page-clamped pixelsPerBeat.');

  const pageWidth = 700;
  const contentW = getFigureContentWidthPx(pageWidth, 65);
  const maxFit = maxPixelsPerBeatToFitPage({
    contentWidthPx: contentW,
    measuresPerLine: 4,
    beatsPerMeasure: 4,
  });
  assert(clampPixelsPerBeatToPage(120, maxFit) <= maxFit + 1e-6, 'Loose spacing must clamp to 4 bars × 4 beats on the page.');
  const rawRow = [120 * 4, 120 * 4, 120 * 4, 120 * 4];
  const fittedRow = fitWidthsToContentWidth(rawRow, contentW);
  const fittedSum = fittedRow.reduce((a, b) => a + b, 0);
  assert(rawRow.reduce((a, b) => a + b, 0) > contentW, 'Test setup: loose 4×4/4 must overflow before fit.');
  assert(fittedSum <= contentW + 0.51, 'A locked 4-bar row must not exceed the page content width.');
  const layoutEngine = await read('src/layout/LayoutEngine.jsx');
  assert(layoutEngine.includes('fitWidthsToContentWidth'), 'Figurenotes layout must fit measure widths to the page.');

  // Regression check for all time signature digit glyphs 0..9.
  for (let digit = 0; digit <= 9; digit += 1) {
    assert(
      smuflGlyphs.includes(`timeSig${digit}:`),
      `Missing SMuFL glyph mapping key for timeSig${digit}.`
    );
  }

  // The generator path must remain formula-based so multi-digit signatures (e.g. 12/8) stay deterministic.
  assert(
    smuflGlyphs.includes('return String.fromCharCode(0xE080 + n);'),
    'Time signature digit generator no longer uses deterministic SMuFL codepoint formula.'
  );
  assert(
    smuflGlyphs.includes("return s.split('').map((c) => smuflTimeSigDigit(parseInt(c, 10))).filter(Boolean);"),
    'Multi-digit time signature mapper is missing or changed unexpectedly.'
  );

  console.log('Export determinism smoke checks passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
