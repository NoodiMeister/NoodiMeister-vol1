/**
 * Export bass clef on staff to PNG. Leland font only (Puppeteer).
 * Run: node scripts/export-bass-clef-on-staff-png.js
 * Requires: npm install puppeteer --save-dev
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
const centerY = 80;
const startY = centerY - 2 * staffSpace;
const staffLinePositions = [0, 1, 2, 3, 4].map((i) => startY + i * staffSpace);
const bassFLine = staffLinePositions[1];
const clefFontSize = staffSpace * 4;
const clefX = 28;
const staffLeft = 0;
const staffRight = 320;
const width = 360;
const height = 180;
const padTop = 24;
const lineNames = ['A3', 'F3', 'D3', 'B2', 'G2'];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(FONT_PATH)) {
    console.error('Leland font missing:', FONT_PATH);
    process.exit(1);
  }

  const Puppeteer = (await import('puppeteer')).default;
  const fontDataUrl = `data:font/woff2;base64,${fs.readFileSync(FONT_PATH).toString('base64')}`;

  const staffLines = staffLinePositions
    .map((y) => `<line x1="${staffLeft}" y1="${padTop + y}" x2="${staffRight}" y2="${padTop + y}" stroke="#000" stroke-width="1.2"/>`)
    .join('\n  ');
  const labels = staffLinePositions
    .map((y, i) => `<text x="${staffRight + 12}" y="${padTop + y}" font-family="sans-serif" font-size="11" fill="#666">${lineNames[i]}</text>`)
    .join('\n  ');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
@font-face{font-family:'Leland';src:url('${fontDataUrl}') format('woff2');}
body{margin:0;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#fff"/>
  ${staffLines}
  <text x="${clefX}" y="${padTop + bassFLine}" font-family="Leland" font-size="${clefFontSize}" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">\uE062</text>
  ${labels}
  <text x="${clefX}" y="${padTop + 2 * staffSpace + 22}" font-family="sans-serif" font-size="11" fill="#888" text-anchor="middle">clef center = F line</text>
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
