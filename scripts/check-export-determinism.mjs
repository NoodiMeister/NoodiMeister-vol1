import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

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
