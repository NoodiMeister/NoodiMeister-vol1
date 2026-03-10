/**
 * Export bass clef on staff to PNG. Uses Leland font (fClef U+E062) for the clef.
 * Run: node scripts/export-bass-clef-on-staff-png.js
 * Requires: npm install puppeteer --save-dev, public/fonts/Leland.woff2
 * Writes: docs/symbol-previews/bass-clef-on-staff.png
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'docs', 'symbol-previews');
const OUT_PATH = path.join(OUT_DIR, 'bass-clef-on-staff.png');
const FONT_PATH = path.join(__dirname, '..', 'public', 'fonts', 'Leland.woff2');

const staffSpace = 10;
const half = staffSpace / 2;
const centerY = 80;
// Place staff so the 4th line (F line) is the reference; one line higher than centering on 3rd line.
const startY = centerY - 3 * staffSpace;
const staffLinePositions = [0, 1, 2, 3, 4].map((i) => startY + i * staffSpace);
// Bass clef (F clef): two dots and big dot sit on the F line (4th line from bottom). Index: 0=top=A3, 4=bottom=G2.
const BASS_CLEF_F_LINE_INDEX = 1; // F3 = 4th line from bottom
const bassFLine = staffLinePositions[BASS_CLEF_F_LINE_INDEX];
// Vertical offset so the 4th line runs through the middle of the two dots and through the big dot (Leland glyph center ≠ optical center).
const bassClefAlignDy = staffSpace * 0.35;
// Whole clef drawn one staff space higher than the F line (so the clef sits above its nominal position).
const bassClefOneStaffHigher = -staffSpace;
const clefFontSize = staffSpace * 4;
const clefX = 28;
const staffLeft = 0;
const staffRight = 320;
const width = 360;
const height = 220;
const padTop = 24;

// SMuFL fClef (bass clef) in Leland
const F_CLEF = '\uE062';

// Staff lines (index 0 = top/5th line, index 4 = bottom/1st line). Standard bass clef:
// 1st line (bottom) = G2, 2nd = B2, 3rd = D3, 4th = F3, 5th (top) = A3.
const lineNames = ['A3', 'F3', 'D3', 'B2', 'G2'];
// Gaps (spaces between lines): 1st gap = A2, 2nd = C3, 3rd = E3, 4th = G3.
const gapNames = ['G3', 'E3', 'C3', 'A2'];
const gapY = (i) => startY + (i + 0.5) * staffSpace;
// Ledger: 1st ledger under 1st staff line = E2; 2nd = C2. 1st ledger over 5th line = C4; 2nd = E4.
const firstLineY = staffLinePositions[0];
const lastLineY = staffLinePositions[4];
const ledgerBelowY = (n) => (n === 1 ? lastLineY + half : lastLineY + 3 * half);
const ledgerAboveY = (n) => (n === 1 ? firstLineY - half : firstLineY - 3 * half);

function lelandFontDataUrl() {
  if (!fs.existsSync(FONT_PATH)) return null;
  const woff2 = fs.readFileSync(FONT_PATH);
  return `data:font/woff2;base64,${woff2.toString('base64')}`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const fontUrl = lelandFontDataUrl();
  if (!fontUrl) {
    console.error('Leland.woff2 not found at', FONT_PATH);
    process.exit(1);
  }

  const Puppeteer = (await import('puppeteer')).default;

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
    `<text x="${clefX + ledgerHalfWidth + 6}" y="${padTop + ledgerBelowY(1)}" font-family="sans-serif" font-size="10" fill="#666">E2 (1st ledger)</text>`,
    `<text x="${clefX + ledgerHalfWidth + 6}" y="${padTop + ledgerBelowY(2)}" font-family="sans-serif" font-size="10" fill="#666">C2 (2nd ledger)</text>`,
  ].join('\n  ');
  const ledgerLinesAbove = [1, 2]
    .map((n) => `<line x1="${clefX - ledgerHalfWidth}" y1="${padTop + ledgerAboveY(n)}" x2="${clefX + ledgerHalfWidth}" y2="${padTop + ledgerAboveY(n)}" stroke="#000" stroke-width="1.2"/>`)
    .join('\n  ');
  const ledgerLabelsAbove = [
    `<text x="${clefX + ledgerHalfWidth + 6}" y="${padTop + ledgerAboveY(1)}" font-family="sans-serif" font-size="10" fill="#666">C4 (1st ledger)</text>`,
    `<text x="${clefX + ledgerHalfWidth + 6}" y="${padTop + ledgerAboveY(2)}" font-family="sans-serif" font-size="10" fill="#666">E4 (2nd ledger)</text>`,
  ].join('\n  ');

  const clefY = padTop + bassFLine + bassClefAlignDy + bassClefOneStaffHigher;
  const bassClefText = `<text x="${clefX}" y="${clefY}" font-family="Leland,sans-serif" font-size="${clefFontSize}" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">${F_CLEF}</text>`;

  const fontStyle = `@font-face{font-family:'Leland';src:url('${fontUrl}') format('woff2');}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${fontStyle}</style><style>
body{margin:0;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#fff"/>
  ${ledgerLinesAbove}
  ${staffLines}
  ${ledgerLinesBelow}
  ${bassClefText}
  ${lineLabels}
  ${gapLabels}
  ${ledgerLabelsAbove}
  ${ledgerLabelsBelow}
  <text x="${clefX}" y="${padTop + bassFLine + 22}" font-family="sans-serif" font-size="11" fill="#888" text-anchor="middle">F line (clef center)</text>
</svg></body></html>`;

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
