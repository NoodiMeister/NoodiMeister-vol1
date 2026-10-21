import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { layoutYToDeskDisplayY, snapSystemYToPage, getNotationPageBodies } from '../src/utils/pageGeometry.js';
import {
  getFigureContentWidthPx,
  maxPixelsPerBeatToFitPage,
  clampPixelsPerBeatToPage,
  fitWidthsToContentWidth,
  minPixelsPerBeatForFigures,
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
  assert(scoreToSvg.includes('measureScoreExportHeaderFromContainer'), 'Export must measure DOM header height for container parity.');
  assert(scoreToSvg.includes('pageOverlayTransform'), 'Text boxes must share notation export overlay transform.');
  assert(scoreToSvg.includes('getScoreNotationExportTransform'), 'Export overlay transform must derive from layout snapshot.');
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
  assert(smuflGlyphs.includes('noteheadTriangleDownBlack'), 'SMuFL notehead catalog must include triangle-down (MuseScore group).');
  assert(smuflGlyphs.includes('noteheadDiamondBlack'), 'SMuFL notehead catalog must include diamond (MuseScore group).');
  assert(smuflGlyphs.includes('smuflNoteheadForDurationLabel'), 'Duration-aware notehead glyph helper is missing.');
  const noteheadCatalog = await read('src/notation/noteheadShapeCatalog.js');
  assert(noteheadCatalog.includes('triangleUp') && noteheadCatalog.includes('triangleDown') && noteheadCatalog.includes('diamond'), 'Notehead shape catalog must expose MuseScore-inspired shapes.');
  assert(app.includes('NOTEHEAD_SHAPE_DEFS'), 'Notehead toolbox must be driven by NOTEHEAD_SHAPE_DEFS.');
  assert(app.includes('noteInputMode && !activeToolbox'), 'N-mode must not show rhythm strip when another toolbox (e.g. notehead) is open.');
  assert(!app.includes("noteheadShape === 'x' || noteheadShape === 'square' || noteheadShape === 'triangle' ? 'oval'"), 'Traditional staff must not force shaped noteheads back to oval.');
  assert(figurenotesView.includes('fontFamily={SMUFL_MUSIC_FONT_FAMILY}'), 'Figurenotes time signature is not forced to canonical SMuFL font family.');
  assert(
    figurenotesView.includes('className="nm-export-omit"') && scoreToSvg.includes('.nm-export-omit'),
    'Figurenotes pedagogical SMuFL underlayer must be marked nm-export-omit and stripped in scoreToSvg (svg2pdf ghost stem/flag).'
  );
  assert(
    scoreToSvg.includes('hardenExportSvgPaints') || scoreToSvg.includes('resolveCssVarPaint'),
    'Export SVG must resolve CSS var() paints for svg2pdf.'
  );
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
  assert(app.includes('effectivePixelsPerBeat'), 'Layout must expose effectivePixelsPerBeat from the user setting.');
  assert(
    !app.includes('clampPixelsPerBeatToPage(pixelsPerBeat'),
    'Do not pre-clamp pixelsPerBeat to page max before layout (locks the UI).'
  );
  assert(app.includes('spacingIsPageLimited'), 'UI must detect when desired spacing exceeds the page edge.');

  const pageWidth = 700;
  const contentW = getFigureContentWidthPx(pageWidth, 65);
  const maxFit = maxPixelsPerBeatToFitPage({
    contentWidthPx: contentW,
    measuresPerLine: 4,
    beatsPerMeasure: 4,
  });
  assert(maxFit > 0 && maxFit < 120, 'Page max px/beat for 4×4/4 must be below the loose preset.');
  assert(clampPixelsPerBeatToPage(120, maxFit) <= maxFit + 1e-6, 'Helper still clamps when used explicitly.');
  const rawRow = [120 * 4, 120 * 4, 120 * 4, 120 * 4];
  const fittedRow = fitWidthsToContentWidth(rawRow, contentW);
  const fittedSum = fittedRow.reduce((a, b) => a + b, 0);
  assert(rawRow.reduce((a, b) => a + b, 0) > contentW, 'Test setup: loose 4×4/4 must overflow before fit.');
  assert(fittedSum <= contentW + 0.51, 'Overflow rows must be scaled to the page content width only.');
  const narrowRow = fitWidthsToContentWidth([20 * 4, 20 * 4, 20 * 4, 20 * 4], contentW);
  const narrowSum = narrowRow.reduce((a, b) => a + b, 0);
  assert(narrowSum < contentW - 1, 'Below-max spacing must keep the row narrower than the page (not force-fill).');
  const layoutEngine = await read('src/layout/LayoutEngine.jsx');
  assert(layoutEngine.includes('fitWidthsToContentWidth'), 'Figurenotes layout must fit measure widths to the page on overflow.');
  assert(
    layoutEngine.includes('minPixelsPerBeatForFigures'),
    'Figurenotes layout must reflow using a figure-size floor so notes do not overlap.'
  );
  assert(
    layoutEngine.includes('wouldCrushFigures'),
    'Figurenotes layout must break the row before page-fit would crush figures.'
  );
  assert(minPixelsPerBeatForFigures(85) >= 85, 'Figure floor must be at least figure diameter.');
  assert(minPixelsPerBeatForFigures(85) > maxFit, 'Default figures must force fewer measures/line than a crushed 4×4/4 fit.');

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
