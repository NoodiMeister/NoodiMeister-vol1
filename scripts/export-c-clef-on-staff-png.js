/**
 * Export C clef (alto clef) on staff to PNG. Uses Leland font (cClef U+E05C).
 * Alignment: the middle "arrow" of the C clef (where the two curves meet) sits on the 3rd staff line (middle line = middle C).
 * Run: node scripts/export-c-clef-on-staff-png.js
 * Requires: npm install puppeteer --save-dev, public/fonts/Leland.woff2
 * Writes: docs/symbol-previews/c-clef-on-staff.png
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'docs', 'symbol-previews');
const OUT_PATH = path.join(OUT_DIR, 'c-clef-on-staff.png');
const FONT_PATH = path.join(__dirname, '..', 'public', 'fonts', 'Leland.woff2');

const staffSpace = 10;
const half = staffSpace / 2;
const centerY = 80;
const startY = centerY - 2.5 * staffSpace;
const staffLinePositions = [0, 1, 2, 3, 4].map((i) => startY + i * staffSpace);
// C clef: middle "arrow" on the 2nd staff line (one line up from middle). Index: 0=top, 1=2nd line.
const C_CLEF_LINE_INDEX = 1;
const middleLineY = staffLinePositions[C_CLEF_LINE_INDEX];
// Vertical offset so the 3rd line runs through the middle arrow (Leland glyph center may need a small nudge).
const cClefAlignDy = staffSpace * 0;
const clefFontSize = staffSpace * 4;
const clefX = 28;
const staffLeft = 0;
const staffRight = 320;
const width = 360;
const height = 220;
const padTop = 24;

// SMuFL cClef (C clef / alto clef) in Leland
const C_CLEF = '\uE05C';

// Staff lines (index 0 = top). Clef one line up: 2nd line = C4 (tenor clef).
// 1st (bottom) = D3, 2nd = F3, 3rd = A3, 4th = C4, 5th (top) = E4.
const lineNames = ['E4', 'C4', 'A3', 'F3', 'D3'];
const gapNames = ['D4', 'G3', 'E3', 'C3'];
const gapY = (i) => startY + (i + 0.5) * staffSpace;
const firstLineY = staffLinePositions[0];
const lastLineY = staffLinePositions[4];
const ledgerBelowY = (n) => (n === 1 ? lastLineY + half : lastLineY + 3 * half);
const ledgerAboveY = (n) => (n === 1 ? firstLineY - half : firstLineY - 3 * half);

function lelandFontDataUrl() {
  if (!fs.existsSync(FONT_PATH)) return null;
  const woff2 = fs.readFileSync(FONT_PATH);
  return `data:font/woff2;base64,${woff2.toString('base64')}`;
}

function buildSvgContent() {
  const ledgerHalfWidth = staffSpace * 1.4;
  const staffLines = staffLinePositions
    .map((y) => `<line x1="${staffLeft}" y1="${padTop + y}" x2="${staffRight}" y2="${padTop + y}" stroke="#000" stroke-width="1.2"/>`)
    .join('\n  ');
  const lineLabels = staffLinePositions
    .map((y, i) => `<text x="${staffRight + 12}" y="${padTop + y}" font-family="sans-serif" font-size="11" fill="#666">${lineNames[i]}</text>`)
    .join('\n  ');
  const gapLabels = [0, 1, 2, 3]
    .map((i) => `<text x="${staffRight + 12}" y="${padTop + gapY(i)}" font-family="sans-serif" font-size="10" fill="#999">${gapNames[i]}</text>`)
    .join('\n  ');

  const ledgerLinesBelow = [1, 2]
    .map((n) => `<line x1="${clefX - ledgerHalfWidth}" y1="${padTop + ledgerBelowY(n)}" x2="${clefX + ledgerHalfWidth}" y2="${padTop + ledgerBelowY(n)}" stroke="#000" stroke-width="1.2"/>`)
    .join('\n  ');
  const ledgerLabelsBelow = [
    `<text x="${clefX + ledgerHalfWidth + 6}" y="${padTop + ledgerBelowY(1)}" font-family="sans-serif" font-size="10" fill="#666">B2 (1st ledger)</text>`,
    `<text x="${clefX + ledgerHalfWidth + 6}" y="${padTop + ledgerBelowY(2)}" font-family="sans-serif" font-size="10" fill="#666">G2 (2nd ledger)</text>`,
  ].join('\n  ');
  const ledgerLinesAbove = [1, 2]
    .map((n) => `<line x1="${clefX - ledgerHalfWidth}" y1="${padTop + ledgerAboveY(n)}" x2="${clefX + ledgerHalfWidth}" y2="${padTop + ledgerAboveY(n)}" stroke="#000" stroke-width="1.2"/>`)
    .join('\n  ');
  const ledgerLabelsAbove = [
    `<text x="${clefX + ledgerHalfWidth + 6}" y="${padTop + ledgerAboveY(1)}" font-family="sans-serif" font-size="10" fill="#666">G4 (1st ledger)</text>`,
    `<text x="${clefX + ledgerHalfWidth + 6}" y="${padTop + ledgerAboveY(2)}" font-family="sans-serif" font-size="10" fill="#666">B4 (2nd ledger)</text>`,
  ].join('\n  ');

  const clefY = padTop + middleLineY + cClefAlignDy;
  const cClefText = `<text x="${clefX}" y="${clefY}" font-family="Leland,sans-serif" font-size="${clefFontSize}" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">${C_CLEF}</text>`;

  return {
    staffLines,
    lineLabels,
    gapLabels,
    ledgerLinesBelow,
    ledgerLabelsBelow,
    ledgerLinesAbove,
    ledgerLabelsAbove,
    cClefText,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const fontUrl = lelandFontDataUrl();
  if (!fontUrl) {
    console.error('Leland.woff2 not found at', FONT_PATH);
    process.exit(1);
  }

  const parts = buildSvgContent();
  const fontStyle = `@font-face{font-family:'Leland';src:url('${fontUrl}') format('woff2');}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${fontStyle}</style><style>
body{margin:0;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#fff"/>
  ${parts.ledgerLinesAbove}
  ${parts.staffLines}
  ${parts.ledgerLinesBelow}
  ${parts.cClefText}
  ${parts.lineLabels}
  ${parts.gapLabels}
  ${parts.ledgerLabelsAbove}
  ${parts.ledgerLabelsBelow}
  <text x="${clefX}" y="${padTop + middleLineY + 22}" font-family="sans-serif" font-size="11" fill="#888" text-anchor="middle">2nd line = C4 (clef center / middle arrow)</text>
</svg></body></html>`;

  const htmlPath = path.join(OUT_DIR, 'c-clef-on-staff.html');
  fs.writeFileSync(htmlPath, html);
  console.log('Saved', htmlPath, '(open in browser to view)');

  try {
    const Puppeteer = (await import('puppeteer')).default;
    const browser = await Puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 300));

    const el = await page.$('svg');
    const pngBuffer = await el.screenshot({ type: 'png' });
    await browser.close();

    fs.writeFileSync(OUT_PATH, Buffer.isBuffer(pngBuffer) ? pngBuffer : Buffer.from(pngBuffer));
    console.log('Saved', OUT_PATH);
  } catch (e) {
    console.warn('Puppeteer PNG export skipped:', e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
