/**
 * Export C clef symbol only (no staff) to PNG. Uses Leland font (cClef U+E05C).
 * Run: node scripts/export-clef-c-png.js
 * Requires: npm install puppeteer --save-dev, public/fonts/Leland.woff2
 * Writes: docs/symbol-previews/clef-c.png
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'docs', 'symbol-previews');
const OUT_PATH = path.join(OUT_DIR, 'clef-c.png');
const FONT_PATH = path.join(__dirname, '..', 'public', 'fonts', 'Leland.woff2');

// Same clef size as other clef previews (staffSpace * 4 ≈ 40)
const clefFontSize = 40;
const width = 80;
const height = 80;
const clefX = width / 2;
const clefY = height / 2;

// SMuFL cClef (C clef / alto clef) in Leland — U+E05C
const C_CLEF = '\uE05C';

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

  const cClefText = `<text x="${clefX}" y="${clefY}" font-family="Leland,sans-serif" font-size="${clefFontSize}" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">${C_CLEF}</text>`;

  const fontStyle = `@font-face{font-family:'Leland';src:url('${fontUrl}') format('woff2');}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${fontStyle}</style><style>
body{margin:0;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#fff"/>
  ${cClefText}
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
